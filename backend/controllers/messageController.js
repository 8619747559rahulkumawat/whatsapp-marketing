const Message = require('../models/Message');
const Chat = require('../models/Chat');
const Contact = require('../models/Contact');
const User = require('../models/User');
const whatsappService = require('../services/whatsappService');
const whatsappCloudService = require('../services/whatsappCloudService');
const { formatPhoneNumber } = require('../utils/helpers');

exports.sendMessage = async (req, res) => {
  try {
    const { sessionId, to, messageType, message, mediaUrl, buttons } = req.body;
    if (!sessionId || !to || !message) {
      return res.status(400).json({ success: false, message: 'sessionId, to, and message are required' });
    }
    const phone = formatPhoneNumber(to);
    console.log(`[MessageController] sendMessage: sessionId=${sessionId}, to=${phone}, type=${messageType || 'text'}`);

    let result;
    if (buttons && buttons.length > 0) {
      result = await whatsappService.sendButtonMessage(sessionId, phone, message, buttons);
    } else if (mediaUrl && messageType !== 'text') {
      result = await whatsappService.sendMediaMessage(sessionId, phone, mediaUrl, messageType, message);
    } else {
      result = await whatsappService.sendTextMessage(sessionId, phone, message);
    }
    const waId = typeof result === 'object' && result ? (result.id || '') : '';
    const recipJid = typeof result === 'object' && result ? (result.remoteJid || '') : '';
    console.log(`[MessageController] sendMessage SUCCESS: waId=${waId}, recipJid=${recipJid}`);
    const msg = await Message.create({
      userId: req.user._id,
      tenantId: req.tenant?._id || req.user.tenantId,
      sessionId,
      waMessageId: waId,
      to: phone,
      recipientJid: recipJid,
      messageType: messageType || 'text',
      content: message,
      mediaUrl: mediaUrl || '',
      status: waId ? 'sent' : 'failed',
      sentAt: new Date()
    });
    const io = req.app.get('io');
    if (io) {
      io.to('admin_room').emit('chat:new', { message: msg.content, from: 'admin', to: phone });
      const userChat = await Chat.findOne({ tenantId: req.tenant?._id || req.user.tenantId, waPhone: phone }).sort({ createdAt: -1 });
      if (userChat?.senderId) {
        io.to(`user_${userChat.senderId}`).emit('chat:new', { message: msg.content, from: 'admin', to: phone });
      }
    }
    res.json({ success: true, message: msg });
  } catch (err) {
    console.error(`[MessageController] sendMessage FAILED:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.sendBulk = async (req, res) => {
  try {
    const { sessionId, contacts, messageType, message, mediaUrl, delay, buttons } = req.body;
    if (!sessionId || !Array.isArray(contacts) || contacts.length === 0 || !message) {
      return res.status(400).json({ success: false, message: 'sessionId, contacts array, and message are required' });
    }
    const safeDelay = Math.max(4000, parseInt(delay) || 4000);
    const BATCH_SIZE = 5;
    const results = [];
    const io = req.app.get('io');
    console.log(`[MessageController] sendBulk START: ${contacts.length} contacts, delay=${safeDelay}ms`);

    const sendOne = async (contact, index) => {
      const phone = formatPhoneNumber(contact.phone);
      const lastTen = phone.replace(/[^0-9]/g, '').slice(-10);
      try {
        let result;
        if (buttons && buttons.length > 0) {
          result = await whatsappService.sendButtonMessage(sessionId, phone, message, buttons);
        } else if (mediaUrl && messageType !== 'text') {
          result = await whatsappService.sendMediaMessage(sessionId, phone, mediaUrl, messageType, message);
        } else {
          result = await whatsappService.sendTextMessage(sessionId, phone, message);
        }
        const waId = result?.id || '';
        const recipJid = result?.remoteJid || '';
        // Await DB write to prevent race conditions
        const msg = await Message.create({
          userId: req.user._id,
          tenantId: req.tenant?._id || req.user.tenantId,
          sessionId,
          to: phone,
          waMessageId: waId,
          recipientJid: recipJid,
          messageType: messageType || 'text',
          content: message,
          mediaUrl: mediaUrl || '',
          status: waId ? 'sent' : 'failed',
          sentAt: new Date()
        });
        console.log(`[MessageController] sendBulk [${index + 1}] ...${lastTen} => ${waId ? 'SENT' : 'FAILED'}`);
        return { phone, status: waId ? 'sent' : 'failed', messageId: msg._id };
      } catch (err) {
        console.error(`[MessageController] sendBulk [${index + 1}] ...${lastTen} FAILED: ${err.message}`);
        return { phone, status: 'failed', error: err.message || 'Unknown' };
      }
    };

    // Process sequentially to respect anti-ban delays and prevent race conditions
    for (let i = 0; i < contacts.length; i++) {
      const result = await sendOne(contacts[i], i);
      results.push(result);

      if (io && (i + 1) % BATCH_SIZE === 0) {
        io.to('admin_room').emit('bulk:progress', {
          sent: results.filter(r => r.status === 'sent').length,
          failed: results.filter(r => r.status === 'failed').length,
          total: contacts.length
        });
      }

      if (i < contacts.length - 1) {
        await new Promise(r => setTimeout(r, safeDelay));
      }
      // Extra long pause every 10 messages to avoid rate limits
      if ((i + 1) % 10 === 0 && i < contacts.length - 1) {
        console.log(`[MessageController] sendBulk: 10-message checkpoint, pausing 30s...`);
        await new Promise(r => setTimeout(r, 30000));
      }
    }

    if (req.user.role === 'admin') {
      results.forEach(r => { r.phone = '[Private]'; });
    }
    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;
    console.log(`[MessageController] sendBulk DONE: sent=${sent}, failed=${failed}, total=${contacts.length}`);
    if (io) {
      io.to('admin_room').emit('bulk:completed', { sent, failed, total: contacts.length });
    }
    res.json({ success: true, results, sent, failed });
  } catch (err) {
    console.error(`[MessageController] sendBulk ERROR:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.sendBulkWithImage = async (req, res) => {
  try {
    const sessionId = req.body.sessionId;
    let contacts = req.body.contacts;
    const message = req.body.message;
    const delay = parseInt(req.body.delay) || 4000;
    const safeDelay = Math.max(4000, delay);
    const mediaUrl = req.file ? `/uploads/${req.file.filename}` : '';
    const io = req.app.get('io');
    const BATCH_SIZE = 5;

    if (typeof contacts === 'string') {
      try { contacts = JSON.parse(contacts); } catch { return res.status(400).json({ success: false, message: 'Invalid contacts JSON' }); }
    }
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ success: false, message: 'Contacts required' });
    }
    if (!sessionId || !message) {
      return res.status(400).json({ success: false, message: 'sessionId and message required' });
    }

    const sendOne = async (contact) => {
      const phone = formatPhoneNumber(contact.phone);
      let result;
      if (mediaUrl) {
        result = await whatsappService.sendMediaMessage(sessionId, phone, mediaUrl, 'image', message);
      } else {
        result = await whatsappService.sendTextMessage(sessionId, phone, message);
      }
      const waId = result?.id || '';
      const recipJid = result?.remoteJid || '';
      const msg = await Message.create({
        userId: req.user._id,
        tenantId: req.tenant?._id || req.user.tenantId,
        sessionId,
        to: phone,
        waMessageId: waId,
        recipientJid: recipJid,
        messageType: mediaUrl ? 'image' : 'text',
        content: message,
        mediaUrl: mediaUrl || '',
        status: waId ? 'sent' : 'failed',
        sentAt: new Date()
      });
      return { phone, status: waId ? 'sent' : 'failed', messageId: msg._id };
    };

    const results = [];
    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(batch.map(c => sendOne(c)));
      for (let j = 0; j < batchResults.length; j++) {
        const r = batchResults[j];
        if (r.status === 'fulfilled') {
          results.push(r.value);
        } else {
          results.push({ phone: batch[j].phone, status: 'failed', error: r.reason?.message || 'Unknown' });
        }
      }
      if (io) {
        io.to('admin_room').emit('bulk:progress', {
          sent: results.filter(r => r.status === 'sent').length,
          failed: results.filter(r => r.status === 'failed').length,
          total: contacts.length
        });
      }
      if (i + BATCH_SIZE < contacts.length) {
        await new Promise(r => setTimeout(r, safeDelay));
      }
      if ((i / BATCH_SIZE + 1) % 10 === 0 && i + BATCH_SIZE < contacts.length) {
        await new Promise(r => setTimeout(r, 30000));
      }
    }

    if (req.user.role === 'admin') {
      results.forEach(r => { r.phone = '[Private]'; });
    }
    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;
    if (io) {
      io.to('admin_room').emit('bulk:completed', { sent, failed, total: contacts.length });
    }
    res.json({ success: true, results, sent, failed });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    console.log(`getMessages: user role=${req.user.role}, userId=${req.user._id}, filter=${JSON.stringify(filter)}`);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const messages = await Message.find(filter)
      .populate('campaignId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    if (req.user.role === 'admin') {
      const adminId = req.user._id.toString();
      const sanitizedMessages = messages.map(msg => {
        const msgObj = msg.toObject ? msg.toObject() : { ...msg };
        
        if (msgObj.userId?.toString() !== adminId) {
          msgObj.content = '[Private Message]';
          msgObj.mediaUrl = '';
          msgObj.waMessageId = '';
          msgObj.recipientJid = '';
          msgObj.to = '[Private]';
        }
        
        return msgObj;
      });
      
      const total = await Message.countDocuments(filter);
      res.json({
        success: true,
        messages: sanitizedMessages,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      });
    } else {
      const total = await Message.countDocuments(filter);
      console.log(`getMessages: found ${messages.length} messages, total=${total}`);
      res.json({
        success: true,
        messages,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      });
    }
  } catch (err) {
    console.error('Error in getMessages:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.sendCloudTemplateBatch = async (req, res) => {
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

    const job = whatsappCloudService.startTemplateBatch({
      user: req.user,
      tenantId: req.tenant?._id || req.user.tenantId,
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

exports.getCloudBatchStatus = async (req, res) => {
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

exports.cancelCloudBatch = async (req, res) => {
  try {
    const job = whatsappCloudService.cancelJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Batch job not found or expired' });
    }
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateMessageStatus = async (req, res) => {
  try {
    const msg = await Message.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status, deliveredAt: req.body.status === 'delivered' ? new Date() : undefined },
      { new: true }
    );
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    res.json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDailyStats = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    const stats = await Message.aggregate([
      { $match: filter },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 30 }
    ]);
    res.json({ success: true, stats: stats.map(s => ({ date: s._id, count: s.count })) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getUserStats = async (req, res) => {
  try {
    const stats = await Message.aggregate([
      { $match: { userId: req.params.userId || req.user._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    res.json({ success: true, stats: stats.map(s => ({ status: s._id, count: s.count })) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMessage = async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id).populate('campaignId', 'name');
    if (!msg) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    res.json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
