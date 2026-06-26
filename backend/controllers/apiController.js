const ApiKey = require('../models/ApiKey');
const User = require('../models/User');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const whatsappService = require('../services/whatsappService');
const whatsappCloudService = require('../services/whatsappCloudService');
const { generateApiKey, formatPhoneNumber } = require('../utils/helpers');

const isValidWebhookUrl = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1') return false;
    if (hostname.startsWith('10.') || hostname.startsWith('172.16.') || hostname.startsWith('192.168.')) return false;
    if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return false;
    return true;
  } catch {
    return false;
  }
};

const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (!apiKey) {
      return res.status(401).json({ success: false, message: 'API key required' });
    }
    const keyDoc = await ApiKey.findOne({ key: apiKey, isActive: true }).populate('userId');
    if (!keyDoc) {
      return res.status(401).json({ success: false, message: 'Invalid API key' });
    }
    if (!keyDoc.userId) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    if (!keyDoc.userId.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated' });
    }
    if (!keyDoc.lastUsed || Date.now() - keyDoc.lastUsed.getTime() > 300000) {
      keyDoc.lastUsed = new Date();
      await keyDoc.save();
    }
    req.apiUser = keyDoc.userId;
    req.apiKeyDoc = keyDoc;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getApiKeys = async (req, res) => {
  try {
    const keys = await ApiKey.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, keys });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createApiKey = async (req, res) => {
  try {
    const { name, permissions, webhookUrl } = req.body;
    const key = await ApiKey.create({
      userId: req.user._id,
      tenantId: req.user.tenantId,
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
    const deleted = await ApiKey.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'API key not found' });
    }
    res.json({ success: true, message: 'API key deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.apiSendMessage = async (req, res) => {
  try {
    const { to, message, type, mediaUrl, sessionId } = req.body;
    if (!to || !message) {
      return res.status(400).json({ success: false, message: 'To and message required' });
    }
    const phone = formatPhoneNumber(to);
    const session = await require('../models/Session').findOne({ userId: req.apiUser._id, isActive: true, status: 'connected' });
    if (!session) {
      return res.status(400).json({ success: false, message: 'No active WhatsApp session' });
    }
    const result = await whatsappService.sendTextMessage(session.sessionId, phone, message);
    const waId = result?.id || '';
    const msg = await Message.create({
      userId: req.apiUser._id,
      tenantId: req.apiUser.tenantId,
      sessionId: session._id,
      to: phone,
      waMessageId: waId,
      content: message,
      status: waId ? 'sent' : 'failed',
      sentAt: new Date()
    });
    if (waId) {
      const updated = await User.findOneAndUpdate(
        { _id: req.apiUser._id, credits: { $gte: 1 } },
        { $inc: { credits: -1 } },
        { new: true }
      );
      if (!updated) {
        return res.status(400).json({ success: false, message: 'Insufficient credits' });
      }
    }
    res.json({ success: true, messageId: msg._id, status: waId ? 'sent' : 'failed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.apiSendBulk = async (req, res) => {
  try {
    const { contacts, message, sessionId } = req.body;
    if (!contacts || !message) {
      return res.status(400).json({ success: false, message: 'Contacts and message required' });
    }
    const session = await require('../models/Session').findOne({ userId: req.apiUser._id, isActive: true, status: 'connected' });
    if (!session) {
      return res.status(400).json({ success: false, message: 'No active WhatsApp session' });
    }
    const results = [];
    let successfulCount = 0;
    for (const contact of contacts) {
      try {
        const phone = formatPhoneNumber(contact.phone || contact);
        const result = await whatsappService.sendTextMessage(session.sessionId, phone, message);
        const waId = result?.id || '';
        await Message.create({ userId: req.apiUser._id, tenantId: req.apiUser.tenantId, sessionId: session._id, to: phone, waMessageId: waId, content: message, status: waId ? 'sent' : 'failed', sentAt: new Date() });
        if (waId) successfulCount++;
        results.push({ phone, status: waId ? 'sent' : 'failed' });
      } catch (err) {
        results.push({ phone: contact.phone || contact, status: 'failed', error: err.message });
      }
    }
    if (successfulCount > 0) {
      const updated = await User.findOneAndUpdate(
        { _id: req.apiUser._id, credits: { $gte: successfulCount } },
        { $inc: { credits: -successfulCount } },
        { new: true }
      );
      if (!updated) {
        return res.status(400).json({ success: false, message: 'Insufficient credits' });
      }
    }
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.apiSendCloudTemplateBatch = async (req, res) => {
  try {
    const {
      contacts,
      templateName,
      languageCode,
      components,
      batchSize,
      batchDelayMs,
      dailyLimit,
      confirmOptIn
    } = req.body;

    if (confirmOptIn !== true) {
      return res.status(400).json({
        success: false,
        message: 'confirmOptIn=true is required. Send only to users who gave WhatsApp opt-in permission.'
      });
    }

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ success: false, message: 'contacts array is required' });
    }

    if (!templateName || typeof templateName !== 'string') {
      return res.status(400).json({ success: false, message: 'templateName is required' });
    }

    const user = req.apiUser;
    const job = whatsappCloudService.startTemplateBatch({
      user,
      tenantId: user.tenantId,
      contacts,
      templateName,
      languageCode,
      components,
      batchSize,
      batchDelayMs,
      dailyLimit
    });

    res.status(202).json({
      success: true,
      message: 'WhatsApp Cloud API batch job started',
      job
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.apiGetCloudBatchStatus = async (req, res) => {
  try {
    const job = whatsappCloudService.getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Batch job not found or expired' });
    }
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.apiCreateContact = async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }
    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone || formattedPhone.length < 10) {
      return res.status(400).json({ success: false, message: 'Invalid phone number' });
    }
    const contact = await Contact.create({
      userId: req.apiUser._id,
      tenantId: req.apiUser.tenantId,
      name,
      phone: formattedPhone,
      email,
      source: 'api'
    });
    res.status(201).json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.apiGetReports = async (req, res) => {
  try {
    const filter = { userId: req.apiUser._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.limit) {
      const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(parseInt(req.query.limit));
      return res.json({ success: true, messages });
    }
    const total = await Message.countDocuments(filter);
    const sent = await Message.countDocuments({ ...filter, status: { $in: ['sent', 'delivered', 'read'] } });
    const delivered = await Message.countDocuments({ ...filter, status: { $in: ['delivered', 'read'] } });
    const failed = await Message.countDocuments({ ...filter, status: 'failed' });
    res.json({ success: true, stats: { total, sent, delivered, failed } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.apiWebhook = async (req, res) => {
  try {
    const { event, data } = req.body;
    const apiKeyDoc = req.apiKeyDoc;
    if (!apiKeyDoc.webhookUrl) {
      return res.status(400).json({ success: false, message: 'No webhook URL configured' });
    }
    if (!isValidWebhookUrl(apiKeyDoc.webhookUrl)) {
      return res.status(400).json({ success: false, message: 'Invalid webhook URL' });
    }
    const fetch = require('node-fetch');
    await fetch(apiKeyDoc.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data, timestamp: new Date().toISOString() })
    });
    res.json({ success: true, message: 'Webhook triggered' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports.validateApiKey = validateApiKey;
