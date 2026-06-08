const Session = require('../models/Session');
const Contact = require('../models/Contact');
const GroupScrape = require('../models/GroupScrape');
const whatsappService = require('../services/whatsappService');
const { generateSessionId } = require('../utils/helpers');
const { buildGroupScrapeRows, normalizeExportFormat, sendContactExport } = require('../utils/contactExport');
const mongoose = require('mongoose');

exports.getSessions = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    
    let query = Session.find(filter).sort({ createdAt: -1 });
    if (req.user.role === 'admin') {
      query = query.populate('userId', 'name email phone');
    }
    
    const sessions = await query;
    
    // Sync actual connection status from in-memory Map so frontend shows correct status
    for (const session of sessions) {
      const sock = whatsappService.sessions.get(session.sessionId);
      if (sock && sock.user) {
        session.status = 'connected';
      } else if (sock) {
        session.status = 'connecting';
      } else if (session.qr && session.status !== 'connected') {
        session.status = 'connecting';
      }
      // else keep DB status as-is (disconnected, connecting, etc.)
    }
    
    if (req.user.role === 'admin') {
      const sanitizedSessions = sessions.map(session => {
        const sessionObj = session.toObject ? session.toObject() : { ...session };
        
        if (sessionObj.userId && sessionObj.userId._id && sessionObj.userId._id.toString() !== req.user._id.toString()) {
          sessionObj.qrCode = null;
          sessionObj.qr = null;
          sessionObj.batteryLevel = null;
        }
        
        return sessionObj;
      });
      
      res.json({ success: true, sessions: sanitizedSessions });
    } else {
      res.json({ success: true, sessions });
    }
  } catch (err) {
    console.error('Error in getSessions:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createSession = async (req, res) => {
  try {
    const { name } = req.body;
    const sessionId = generateSessionId();
    const session = await Session.create({
      userId: req.user._id,
      tenantId: req.user.tenantId,
      sessionId,
      name: name || `Session ${Date.now()}`,
      status: 'connecting'
    });
    whatsappService.connectSession(sessionId, req.app.get('io')).catch(err => {
      console.error('Session connect error:', err);
    });
    res.status(201).json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSessionQr = async (req, res) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.id });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const qrState = await whatsappService.waitForSessionQr(req.params.id, req.app.get('io'));
    res.json({
      success: true,
      qr: qrState?.qr || session.qr || '',
      status: qrState?.status || session.status
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.disconnectSession = async (req, res) => {
  try {
    await whatsappService.disconnectSession(req.params.id);
    res.json({ success: true, message: 'Session disconnected' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteSession = async (req, res) => {
  try {
    await whatsappService.removeSession(req.params.id);
    res.json({ success: true, message: 'Session removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.reconnectSession = async (req, res) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.id });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    session.status = 'connecting';
    await session.save();
    whatsappService.connectSession(req.params.id, req.app.get('io')).catch(err => {
      console.error('Reconnect error:', err);
    });
    res.json({ success: true, message: 'Reconnecting...' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getGroups = async (req, res) => {
  try {
    const groups = await whatsappService.getGroups(req.params.id);
    res.json({ success: true, groups });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSessionStatus = async (req, res) => {
  try {
    const status = await whatsappService.getConnectionStatus(req.params.id);
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.pairingCode = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }
    const session = await Session.findOne({ sessionId: req.params.id });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const result = await whatsappService.createPairingSession(req.params.id, phone, req.app.get('io'));
    if (req.app.get('io')) {
      req.app.get('io').emit('pairing:code', { sessionId: req.params.id, pairingCode: result.pairingCode });
    }
    res.json({ success: true, pairingCode: result.pairingCode });
  } catch (err) {
    console.error('[PairingCode] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getContactChat = async (req, res) => {
  try {
    const { id, jid } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const sock = await whatsappService.getReadySocket(id);
    if (!sock || !sock.user) {
      return res.status(400).json({ success: false, message: 'WhatsApp session not connected' });
    }
    const contactJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
    const rawMessages = await sock.loadMessages(contactJid, Math.min(limit, 200));
    const messages = (rawMessages || []).map(m => {
      const key = m.key;
      const msg = m.message;
      let content = '';
      let type = 'text';
      if (msg) {
        if (msg.conversation) { content = msg.conversation; }
        else if (msg.extendedTextMessage?.text) { content = msg.extendedTextMessage.text; }
        else if (msg.imageMessage) { content = '[Image]'; type = 'image'; }
        else if (msg.videoMessage) { content = '[Video]'; type = 'video'; }
        else if (msg.audioMessage) { content = '[Audio]'; type = 'audio'; }
        else if (msg.documentMessage) { content = `[Document: ${msg.documentMessage.fileName || ''}]`; type = 'document'; }
        else if (msg.stickerMessage) { content = '[Sticker]'; type = 'sticker'; }
        else { content = '[Message]'; type = 'other'; }
      }
      const sender = key.participant || key.remoteJid || '';
      const senderPhone = sender.split('@')[0] || '';
      const isMe = key.fromMe;
      return {
        msgId: key.id || '',
        sender, senderPhone,
        content, type,
        isMe: !!isMe,
        timestamp: new Date((m.messageTimestamp || 0) * 1000)
      };
    });
    messages.sort((a, b) => a.timestamp - b.timestamp);
    res.json({ success: true, messages, total: messages.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSessionDiagnostics = async (req, res) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.id })
      .select('sessionId status errorMessage errorDetails lastErrorAt qr createdAt updatedAt');
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const baileysVersion = whatsappService.getSavedVersion ? whatsappService.getSavedVersion() : null;
    res.json({
      success: true,
      diagnostics: {
        sessionId: session.sessionId,
        status: session.status,
        hasError: !!session.errorMessage,
        errorMessage: session.errorMessage || null,
        errorDetails: session.errorDetails || null,
        lastErrorAt: session.lastErrorAt || null,
        hasQR: !!session.qr,
        baileysVersion,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.exportContacts = async (req, res) => {
  const sessionId = String(req.params.id || '').trim();
  const format = normalizeExportFormat(req.query.format || req.params.format);
  const startTime = Date.now();

  console.log('[ExportContacts] Request received', {
    sessionId,
    format,
    userId: req.user?._id?.toString(),
    userRole: req.user?.role,
    tenantId: req.tenant?._id?.toString(),
    query: req.query,
    params: req.params
  });

  try {
    if (!sessionId || sessionId.length < 3 || sessionId.length > 256) {
      console.warn('[ExportContacts] Invalid session ID length', { sessionId, format });
      return res.status(422).json({ success: false, message: 'Invalid session ID format' });
    }

    const tenantId = req.tenant?._id || req.user?.tenantId;
    const sessionFilter = { sessionId };
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      sessionFilter.userId = req.user._id;
    }
    if (tenantId) sessionFilter.tenantId = tenantId;

    const session = await Session.findOne(sessionFilter).lean();
    if (!session) {
      console.warn('[ExportContacts] Session not found', { sessionId, format, filter: sessionFilter });
      return res.status(404).json({ success: false, message: 'Session not found or access denied' });
    }

    const connectionStatus = await whatsappService.getConnectionStatus(sessionId);
    console.log('[ExportContacts] Session status checked', {
      sessionId,
      dbStatus: session.status,
      liveStatus: connectionStatus?.status || 'unknown',
      format,
      sessionPhone: session.phone
    });

    const scrapeFilter = { sessionId };
    if (tenantId) scrapeFilter.tenantId = tenantId;
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      scrapeFilter.userId = req.user._id;
    }

    const scrapes = await GroupScrape.find(scrapeFilter)
      .select('sessionId groupJid groupName groupSubject participants createdAt totalMembers status')
      .sort({ createdAt: -1 })
      .lean();
    
    console.log('[ExportContacts] GroupScrape query result', {
      sessionId, format, scrapeCount: scrapes.length,
      filter: scrapeFilter
    });

    let rows = [];
    let finalContacts = [];

    if (scrapes.length) {
      const phones = new Set();
      for (const scrape of scrapes) {
        for (const member of scrape.participants || []) {
          const phone = member.phone || (member.jid ? member.jid.split('@')[0] : '');
          if (phone) phones.add(phone);
        }
      }

      const existingContacts = await Contact.find({ userId: req.user._id, phone: { $in: Array.from(phones) } }).lean();
      rows = buildGroupScrapeRows(scrapes, existingContacts);
      finalContacts = [...rows];
      console.log('[ExportContacts] Rows from group scrapes', { sessionId, count: rows.length });
    }

    if (!finalContacts.length) {
      console.log('[ExportContacts] No scrapes found, falling back to WhatsApp contacts', { sessionId, format });
      const waContacts = await whatsappService.getAllContacts(sessionId);
      if (waContacts.length) {
        const phones = waContacts.map(c => c.phone).filter(Boolean);
        const existingContacts = await Contact.find({ userId: req.user._id, phone: { $in: phones } }).lean();
        const contactMap = {};
        for (const c of existingContacts) { if (!contactMap[c.phone] || c.name) contactMap[c.phone] = c; }
        finalContacts = waContacts.map(c => ({
          name: (contactMap[c.phone]?.name || c.name || '').trim(),
          phone: c.phone || '',
          address: (contactMap[c.phone]?.address || contactMap[c.phone]?.city || '').trim(),
          group: 'WhatsApp Contacts',
          admin: '-',
          sessionId,
          groupJid: c.jid || '',
          scrapedAt: ''
        }));
        console.log('[ExportContacts] Fallback WhatsApp contacts', { sessionId, count: finalContacts.length });
      }
    }

    if (!finalContacts.length) {
      console.warn('[ExportContacts] No contacts found from any source', { sessionId, format });
      return res.status(404).json({ success: false, message: 'No contacts found to export for this session. Make sure the session is connected and has contacts.' });
    }

    await sendContactExport(res, finalContacts, {
      format,
      filenameBase: `contacts-${sessionId}`
    });

    console.log('[ExportContacts] Export completed successfully', {
      sessionId,
      format,
      contactCount: rows.length,
      durationMs: Date.now() - startTime
    });
  } catch (err) {
    console.error('[ExportContacts] Error', {
      sessionId,
      format,
      error: err.message,
      stack: err.stack,
      durationMs: Date.now() - startTime
    });
    
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return res.status(400).json({ success: false, message: `Validation error: ${err.message}` });
    }
    
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
