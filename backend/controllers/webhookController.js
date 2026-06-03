const Webhook = require('../models/Webhook');
const axios = require('axios');

exports.getWebhooks = async (req, res) => {
  try {
    const webhooks = await Webhook.find({ tenantId: req.tenant._id }).sort({ createdAt: -1 });
    res.json({ success: true, webhooks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createWebhook = async (req, res) => {
  try {
    const webhook = await Webhook.create({
      ...req.body, tenantId: req.tenant._id, userId: req.user._id,
      secret: require('crypto').randomBytes(16).toString('hex')
    });
    res.status(201).json({ success: true, webhook });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateWebhook = async (req, res) => {
  try {
    const webhook = await Webhook.findByIdAndUpdate(
      req.params.id, { ...req.body, updatedAt: new Date() }, { new: true }
    );
    if (!webhook) return res.status(404).json({ success: false, message: 'Webhook not found' });
    res.json({ success: true, webhook });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteWebhook = async (req, res) => {
  try {
    await Webhook.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Webhook deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.testWebhook = async (req, res) => {
  try {
    const webhook = await Webhook.findById(req.params.id);
    if (!webhook) return res.status(404).json({ success: false, message: 'Webhook not found' });
    await axios.post(webhook.url, {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook from RSendix CRM' }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': webhook.secret || ''
      },
      timeout: 10000
    });
    res.json({ success: true, message: 'Webhook test sent successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: `Webhook test failed: ${err.message}` });
  }
};

async function triggerWebhooks(tenantId, event, data) {
  try {
    const webhooks = await Webhook.find({ tenantId, events: event, isActive: true });
    for (const webhook of webhooks) {
      try {
        await axios.post(webhook.url, { event, timestamp: new Date().toISOString(), data }, {
          headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': webhook.secret || '' },
          timeout: 10000
        });
        await Webhook.findByIdAndUpdate(webhook._id, { lastTriggered: new Date() });
      } catch {
        await Webhook.findByIdAndUpdate(webhook._id, { $inc: { failureCount: 1 } });
      }
    }
  } catch {}
}

exports.triggerWebhooks = triggerWebhooks;
