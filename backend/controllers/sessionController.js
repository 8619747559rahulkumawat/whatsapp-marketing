const Session = require('../models/Session');
const Contact = require('../models/Contact');
const whatsappService = require('../services/whatsappService');
const { generateSessionId } = require('../utils/helpers');

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
    res.json({ success: true, qr: session.qr || session.qrCode || '', status: session.status });
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

exports.exportContacts = async (req, res) => {
  try {
    const contacts = await whatsappService.getAllContacts(req.params.id);
    if (!contacts.length) {
      return res.status(400).json({ success: false, message: 'No WhatsApp contacts synced yet. Try "Scrape All Groups" in Group Scraper instead - it extracts all members from your groups. Phone contacts are only available if you have chatted with them recently on this device.' });
    }

    const phones = contacts.map(c => c.phone).filter(Boolean);
    const existingContacts = await Contact.find({ userId: req.user._id, phone: { $in: phones } }).lean();
    const contactMap = {};
    for (const c of existingContacts) {
      if (!contactMap[c.phone] || c.name) contactMap[c.phone] = c;
    }

    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Phone Contacts');

    ws.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Address', key: 'address', width: 35 }
    ];
    ws.getRow(1).font = { bold: true };

    for (const c of contacts) {
      const contact = contactMap[c.phone];
      ws.addRow({
        name: (contact?.name || c.name || '').trim(),
        phone: c.phone,
        address: (contact?.address || contact?.city || '').trim()
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=contacts-${req.params.id}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(`[ExportContacts] Error:`, err.stack || err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
