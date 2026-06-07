const Invoice = require('../models/Invoice');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const billingService = require('../services/billingService');
const Transaction = require('../models/Transaction');
const { calculatePagination } = require('../utils/helpers');

exports.getPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createPlan = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.create(req.body);
    res.status(201).json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    await SubscriptionPlan.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Plan deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getInvoices = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id, userId: req.user._id };
    const { skip, limit, page } = calculatePagination(req.query.page, req.query.limit);
    const [invoices, total] = await Promise.all([
      Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Invoice.countDocuments(filter)
    ]);
    res.json({ success: true, invoices, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createInvoice = async (req, res) => {
  try {
    const { amount, currency, items, billingDetails, planId } = req.body;
    const invoice = await billingService.createInvoice({
      tenantId: req.tenant._id,
      userId: req.user._id,
      amount,
      currency,
      items,
      billingDetails,
      planId
    });
    res.status(201).json({ success: true, invoice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createRazorpayOrder = async (req, res) => {
  try {
    const { amount, currency } = req.body;
    const rate = await billingService.getCreditRate();
    const credits = Math.floor(amount / rate);
    const order = await billingService.createRazorpayOrder(amount, currency, `credits_${req.user._id}`);
    const invoice = await billingService.createInvoice({
      tenantId: req.tenant._id,
      userId: req.user._id,
      amount,
      currency: currency || 'INR',
      items: [{ description: `${credits} Credits`, quantity: 1, unitPrice: amount, total: amount }],
      planId: null
    });
    res.json({ success: true, order, invoice, credits, rate });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, invoiceId } = req.body;
    const isValid = billingService.verifyRazorpayPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    const rate = await billingService.getCreditRate();
    const credits = Math.floor(invoice.amount / rate);
    const result = await billingService.processCreditPurchase({
      userId: req.user._id,
      amount: invoice.amount,
      credits,
      paymentMethod: 'razorpay',
      paymentId: razorpay_payment_id,
      invoiceId
    });
    res.json({ success: true, message: 'Payment successful', ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createStripePaymentIntent = async (req, res) => {
  try {
    const { amount, currency } = req.body;
    const rate = await billingService.getCreditRate();
    const credits = Math.floor(amount / rate);
    const paymentIntent = await billingService.createStripePaymentIntent(amount, currency || 'usd');
    const invoice = await billingService.createInvoice({
      tenantId: req.tenant._id,
      userId: req.user._id,
      amount,
      currency: currency || 'USD',
      items: [{ description: `${credits} Credits`, quantity: 1, unitPrice: amount, total: amount }]
    });
    res.json({ success: true, clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id, invoice, credits, rate });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.confirmStripePayment = async (req, res) => {
  try {
    const { paymentIntentId, invoiceId } = req.body;
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    const rate = await billingService.getCreditRate();
    const credits = Math.floor(invoice.amount / rate);
    const result = await billingService.processCreditPurchase({
      userId: req.user._id,
      amount: invoice.amount,
      credits,
      paymentMethod: 'stripe',
      paymentId: paymentIntentId,
      invoiceId
    });
    await Invoice.findByIdAndUpdate(invoiceId, { stripePaymentIntentId: paymentIntentId });
    res.json({ success: true, message: 'Payment confirmed', ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.subscribeToPlan = async (req, res) => {
  try {
    const { planId, paymentMethod } = req.body;
    if (!planId) return res.status(400).json({ success: false, message: 'Plan ID required' });

    let plan;
    const isValidObjectId = require('mongoose').Types.ObjectId.isValid(planId);
    if (isValidObjectId) {
      plan = await SubscriptionPlan.findById(planId);
      if (!plan || !plan.isActive) return res.status(404).json({ success: false, message: 'Plan not found' });
    } else {
      const defaultPlans = {
        free: { name: 'Free', price: 0, currency: 'INR', interval: 'month' },
        starter: { name: 'Starter', price: 499, currency: 'INR', interval: 'month' },
        professional: { name: 'Professional', price: 1999, currency: 'INR', interval: 'month' },
        enterprise: { name: 'Enterprise', price: 9999, currency: 'INR', interval: 'month' }
      };
      if (!defaultPlans[planId]) return res.status(404).json({ success: false, message: 'Plan not found' });
      plan = defaultPlans[planId];
    }

    if (plan.price === 0) {
      await Tenant.findByIdAndUpdate(req.tenant._id, {
        plan: plan.name.toLowerCase(),
        'billing.currentPeriodEnd': new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      });
      return res.json({ success: true, plan: { name: plan.name }, message: `Subscribed to ${plan.name} plan` });
    }

    const invoice = await billingService.createInvoice({
      tenantId: req.tenant._id,
      userId: req.user._id,
      amount: plan.price,
      currency: plan.currency,
      items: [{ description: `${plan.name} Plan - ${plan.interval}ly`, quantity: 1, unitPrice: plan.price, total: plan.price }],
      planId: isValidObjectId ? plan._id : null
    });

    if (paymentMethod === 'razorpay') {
      const order = await billingService.createRazorpayOrder(plan.price, plan.currency, `plan_${planId}`);
      await Invoice.findByIdAndUpdate(invoice._id, { razorpayOrderId: order.id });
      return res.json({ success: true, order, invoice, plan, paymentMethod: 'razorpay' });
    }

    if (paymentMethod === 'stripe') {
      const paymentIntent = await billingService.createStripePaymentIntent(plan.price, plan.currency);
      await Invoice.findByIdAndUpdate(invoice._id, { stripePaymentIntentId: paymentIntent.id });
      return res.json({ success: true, clientSecret: paymentIntent.client_secret, invoice, plan, paymentMethod: 'stripe' });
    }

    res.status(400).json({ success: false, message: 'Invalid payment method' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.confirmPlanSubscription = async (req, res) => {
  try {
    const { invoiceId, paymentId, paymentMethod } = req.body;
    const invoice = await Invoice.findById(invoiceId).populate('planId');
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (!invoice.planId) return res.status(400).json({ success: false, message: 'Not a subscription invoice' });

    const plan = invoice.planId;
    await Invoice.findByIdAndUpdate(invoiceId, {
      status: 'paid',
      paymentMethod,
      paymentId,
      paidAt: new Date()
    });

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + (plan.intervalCount || 1));

    await Tenant.findByIdAndUpdate(req.tenant._id, {
      plan: plan.name.toLowerCase(),
      'billing.subscriptionId': paymentId,
      'billing.currentPeriodEnd': periodEnd,
      'billing.invoiceDate': new Date(),
      'settings.limits.contacts': plan.limits?.contacts || 0,
      'settings.limits.messagesPerDay': plan.limits?.messagesPerDay || 0,
      'settings.limits.users': plan.limits?.users || 0
    });

    res.json({
      success: true,
      message: `Successfully subscribed to ${plan.name} plan`,
      plan: { name: plan.name, features: plan.features, periodEnd }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCreditRate = async (req, res) => {
  try {
    const rate = await billingService.getCreditRate();
    res.json({ success: true, rate });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.verifyUpiPayment = async (req, res) => {
  try {
    const { upiTransactionId, amount, planId } = req.body;
    if (!upiTransactionId || !amount) {
      return res.status(400).json({ success: false, message: 'UPI transaction ID and amount required' });
    }
    const rate = await billingService.getCreditRate();
    const credits = Math.floor(amount / rate);
    const invoice = await billingService.createInvoice({
      tenantId: req.tenant._id,
      userId: req.user._id,
      amount,
      currency: 'INR',
      items: [{ description: `${credits} Credits via UPI QR`, quantity: 1, unitPrice: amount, total: amount }],
      planId: planId || null
    });
    await Invoice.findByIdAndUpdate(invoice._id, {
      status: 'paid',
      paymentMethod: 'upi_qr',
      paymentId: upiTransactionId,
      paidAt: new Date()
    });
    const result = await billingService.processCreditPurchase({
      userId: req.user._id,
      amount,
      credits,
      paymentMethod: 'upi_qr',
      paymentId: upiTransactionId,
      invoiceId: invoice._id
    });
    res.json({ success: true, message: 'Payment verified! Credits added.', ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllInvoices = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    const { skip, limit, page } = calculatePagination(req.query.page, req.query.limit);
    const [invoices, total] = await Promise.all([
      Invoice.find(filter).populate('userId', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Invoice.countDocuments(filter)
    ]);
    res.json({ success: true, invoices, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
