const axios = require('axios');
const crypto = require('crypto');
const Contact = require('../models/Contact');
const Campaign = require('../models/Campaign');
const AutomationFlow = require('../models/AutomationFlow');
const automationService = require('./automationService');

const SHOPIFY_API_VERSION = '2024-01';

const timingSafeCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
};

const verifyShopifyWebhook = (req) => {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  if (!hmacHeader) return false;
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
  const digest = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('base64');
  return timingSafeCompare(digest, hmacHeader);
};

const verifyWooCommerceWebhook = (req) => {
  const signature = req.headers['x-wc-webhook-signature'];
  if (!signature) return false;
  const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET || '';
  const digest = crypto.createHmac('sha256', secret).update(req.rawBody || JSON.stringify(req.body)).digest('base64');
  return timingSafeCompare(digest, signature);
};

const handleAbandonedCheckout = async (data, platform, tenantId, io) => {
  const email = data.email || data.customer?.email;
  const phone = data.phone || data.customer?.phone || data.billing?.phone;
  const checkoutUrl = data.checkout_url || data.cart_url || data.abandoned_checkout_url;
  const customerName = data.customer?.firstName || data.billing?.first_name || 'Customer';
  const totalPrice = data.total_price || data.total || '0';

  if (!phone && !email) return { success: false, message: 'No contact info' };

  const formattedPhone = phone ? phone.replace(/[^+\d]/g, '') : null;

  let contact = null;
  if (formattedPhone) {
    contact = await Contact.findOne({ phone: formattedPhone, tenantId });
    if (!contact) {
      contact = await Contact.create({
        tenantId, userId: data.userId || null,
        phone: formattedPhone, name: customerName, email: email || '',
        source: `${platform}_checkout`,
        variables: { platform, checkoutUrl, totalPrice }
      });
    }
  }

  const flows = await AutomationFlow.find({
    tenantId, status: 'active',
    'trigger.type': 'webhook',
    'trigger.config.event': { $in: [`${platform}.abandoned_checkout`, 'ecommerce.abandoned_checkout'] }
  });

  for (const flow of flows) {
    const context = {
      userId: flow.userId, tenantId,
      contact, phone: formattedPhone, email,
      platform, checkoutUrl, totalPrice, customerName,
      event: 'abandoned_checkout'
    };
    automationService.executeFlow(flow._id, context, io).catch(() => {});
  }

  return { success: true, flowsTriggered: flows.length, contact: !!contact };
};

const handleOrderCreated = async (data, platform, tenantId, io) => {
  const email = data.email || data.customer?.email || data.billing?.email;
  const phone = data.phone || data.customer?.phone || data.billing?.phone;
  const orderId = data.order_number || data.id || data.number;
  const totalPrice = data.total_price || data.total || '0';
  const status = data.financial_status || data.status || 'pending';

  const formattedPhone = phone ? phone.replace(/[^+\d]/g, '') : null;

  let contact = null;
  if (formattedPhone) {
    contact = await Contact.findOne({ phone: formattedPhone, tenantId });
    if (!contact) {
      contact = await Contact.create({
        tenantId, userId: data.userId || null,
        phone: formattedPhone, name: data.customer?.firstName || data.billing?.first_name || 'Customer',
        email: email || '', source: `${platform}_order`,
        variables: { platform, orderId, totalPrice, orderStatus: status }
      });
    } else {
      contact.variables = { ...contact.variables, lastOrderId: orderId, orderStatus: status };
      await contact.save();
    }
  }

  const flows = await AutomationFlow.find({
    tenantId, status: 'active',
    'trigger.type': 'webhook',
    'trigger.config.event': { $in: [`${platform}.order_created`, 'ecommerce.order_created'] }
  });

  for (const flow of flows) {
    const context = {
      userId: flow.userId, tenantId,
      contact, phone: formattedPhone, email,
      platform, orderId, totalPrice, status,
      event: 'order_created'
    };
    automationService.executeFlow(flow._id, context, io).catch(() => {});
  }

  return { success: true, flowsTriggered: flows.length };
};

const handleOrderUpdated = async (data, platform, tenantId, io) => {
  const phone = data.phone || data.customer?.phone || data.billing?.phone;
  const formattedPhone = phone ? phone.replace(/[^+\d]/g, '') : null;
  const status = data.fulfillment_status || data.status || data.financial_status;

  const flows = await AutomationFlow.find({
    tenantId, status: 'active',
    'trigger.type': 'webhook',
    'trigger.config.event': { $in: [`${platform}.order_updated`, 'ecommerce.order_status_changed'] }
  });

  let contact = null;
  if (formattedPhone) contact = await Contact.findOne({ phone: formattedPhone, tenantId });

  for (const flow of flows) {
    const context = {
      userId: flow.userId, tenantId,
      contact, phone: formattedPhone,
      platform, orderId: data.order_number || data.id,
      status, event: 'order_updated'
    };
    automationService.executeFlow(flow._id, context, io).catch(() => {});
  }

  return { success: true, flowsTriggered: flows.length };
};

module.exports = {
  verifyShopifyWebhook, verifyWooCommerceWebhook,
  handleAbandonedCheckout, handleOrderCreated, handleOrderUpdated
};
