const WebhookEndpoint = require('../models/WebhookEndpoint');
const ApiKey = require('../models/ApiKey');
const crypto = require('crypto');
const axios = require('axios');

exports.getWebhooks = async (req, res) => {
  try {
    const webhooks = await WebhookEndpoint.find({ tenantId: req.tenant._id, userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, webhooks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createWebhook = async (req, res) => {
  try {
    const { name, url, events, headers, retryConfig } = req.body;
    const secret = crypto.randomBytes(16).toString('hex');
    const webhook = await WebhookEndpoint.create({
      tenantId: req.tenant._id,
      userId: req.user._id,
      name,
      url,
      secret,
      events: events || ['message.sent', 'message.delivered', 'message.failed'],
      headers: headers || {},
      retryConfig: retryConfig || { maxRetries: 3, retryInterval: 5000 }
    });
    res.status(201).json({ success: true, webhook });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateWebhook = async (req, res) => {
  try {
    const webhook = await WebhookEndpoint.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!webhook) return res.status(404).json({ success: false, message: 'Webhook not found' });
    res.json({ success: true, webhook });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteWebhook = async (req, res) => {
  try {
    const webhook = await WebhookEndpoint.findOneAndDelete({ _id: req.params.id, tenantId: req.tenant._id });
    if (!webhook) return res.status(404).json({ success: false, message: 'Webhook not found' });
    res.json({ success: true, message: 'Webhook deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.testWebhook = async (req, res) => {
  try {
    const webhook = await WebhookEndpoint.findOne({ _id: req.params.id, tenantId: req.tenant._id });
    if (!webhook) return res.status(404).json({ success: false, message: 'Webhook not found' });
    const payload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook from RSendix.pro' }
    };
    await axios.post(webhook.url, payload, {
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': webhook.secret, ...webhook.headers },
      timeout: 10000
    });
    await WebhookEndpoint.findByIdAndUpdate(webhook._id, { lastTriggered: new Date(), lastSuccess: new Date() });
    res.json({ success: true, message: 'Webhook test sent successfully' });
  } catch (err) {
    await WebhookEndpoint.findByIdAndUpdate(req.params.id, { lastFailure: new Date(), $inc: { failureCount: 1 } });
    res.status(500).json({ success: false, message: `Webhook test failed: ${err.message}` });
  }
};

exports.triggerWebhookEvent = async (event, payload, tenantId) => {
  try {
    const webhooks = await WebhookEndpoint.find({ tenantId, isActive: true, events: event });
    for (const webhook of webhooks) {
      const data = { event, timestamp: new Date().toISOString(), data: payload };
      axios.post(webhook.url, data, {
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': webhook.secret, ...webhook.headers },
        timeout: 10000
      }).then(() => {
        WebhookEndpoint.findByIdAndUpdate(webhook._id, { lastTriggered: new Date(), lastSuccess: new Date() }).catch(() => {});
      }).catch(() => {
        WebhookEndpoint.findByIdAndUpdate(webhook._id, { lastFailure: new Date(), $inc: { failureCount: 1 } }).catch(() => {});
      });
    }
  } catch (err) {
    console.error('Webhook trigger error:', err.message);
  }
};

exports.getApiKeys = async (req, res) => {
  try {
    const keys = await ApiKey.find({ tenantId: req.tenant._id, userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, keys });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createApiKey = async (req, res) => {
  try {
    const { name, permissions, webhookUrl } = req.body;
    const { generateApiKey } = require('../utils/helpers');
    const key = await ApiKey.create({
      tenantId: req.tenant._id,
      userId: req.user._id,
      name,
      key: generateApiKey(),
      permissions: permissions || ['send'],
      webhookUrl: webhookUrl || ''
    });
    res.status(201).json({ success: true, key });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteApiKey = async (req, res) => {
  try {
    await ApiKey.findOneAndDelete({ _id: req.params.id, tenantId: req.tenant._id });
    res.json({ success: true, message: 'API key deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
