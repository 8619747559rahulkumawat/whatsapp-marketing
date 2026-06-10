const path = require('path');
const fs = require('fs');
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

// ---------------------------------------------------------------------------
// Read contacts.json from session disk directory (persisted by Baileys events)
// ---------------------------------------------------------------------------
const readContactsFromDisk = (sessionId) => {
  const dir = path.join(process.cwd(), process.env.SESSIONS_DIR || 'sessions', sessionId);
  const file = path.join(dir, 'contacts.json');
  if (fs.existsSync(file)) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      const entries = Object.entries(raw).filter(([jid]) => jid && !jid.includes('@g.us'));
      console.log('[DiskContacts] Found', entries.length, 'contacts in', file);
      return entries.map(([jid, c]) => ({
        phone: c.id?.split('@')[0] || jid.split('@')[0] || '',
        name: c.name || c.notify || c.verifiedName || '',
        jid: c.id || jid || '',
        pushName: c.name || '',
        verifiedName: c.verifiedName || '',
        isBusiness: !!c.business
      })).filter(c => c.phone.length >= 8);
    } catch (e) {
      console.log('[DiskContacts] Parse error:', e.message);
    }
  } else {
    console.log('[DiskContacts] No contacts.json at', file);
  }
  return [];
};

// ---------------------------------------------------------------------------
// Auto-sync: fetch contacts from ALL possible Baileys sources + disk + save to MongoDB
// ---------------------------------------------------------------------------
const autoSyncContactsToDb = async (sessionId, userId, tenantId) => {
  console.log('[AutoSync] Starting auto-sync for', { sessionId, userId });
  let syncedCount = 0;
  const rawContacts = [];

  // 1) getAllContacts (checks in-memory map, sock.contacts, then contacts.json)
  try {
    const waContacts = await whatsappService.getAllContacts(sessionId);
    console.log('[AutoSync] getAllContacts returned', waContacts.length);
    for (const c of waContacts) {
      if (c.phone && c.phone.length >= 8) rawContacts.push({ phone: c.phone, name: c.name || '', jid: c.jid || '' });
    }
  } catch (e) { console.log('[AutoSync] getAllContacts error:', e.message); }

  // 2) Direct socket contacts
  if (!rawContacts.length) {
    try {
      const sock = whatsappService.sessions?.get?.(sessionId);
      if (sock?.contacts) {
        let entries = [];
        if (sock.contacts instanceof Map) {
          for (const [jid, c] of sock.contacts) {
            if (jid && !jid.includes('@g.us')) entries.push([jid, c]);
          }
        } else if (typeof sock.contacts === 'object') {
          entries = Object.entries(sock.contacts).filter(([j]) => j && !j.includes('@g.us'));
        }
        console.log('[AutoSync] Socket contacts:', entries.length);
        for (const [, c] of entries) {
          const p = c.id?.split('@')[0] || '';
          if (p && p.length >= 8) rawContacts.push({ phone: p, name: c.name || c.notify || c.verifiedName || '', jid: c.id || '' });
        }
      }
    } catch (e) { console.log('[AutoSync] Socket error:', e.message); }
  }

  // 3) Baileys store contacts
  if (!rawContacts.length) {
    try {
      const sock = whatsappService.sessions?.get?.(sessionId);
      if (sock?.store?.contacts) {
        const store = sock.store.contacts;
        let entries = [];
        if (store instanceof Map) {
          for (const [jid, c] of store) {
            if (jid && !jid.includes('@g.us')) entries.push([jid, c]);
          }
        } else if (typeof store === 'object') {
          entries = Object.entries(store).filter(([j]) => j && !j.includes('@g.us'));
        }
        console.log('[AutoSync] Store contacts:', entries.length);
        for (const [, c] of entries) {
          const p = c.id?.split('@')[0] || '';
          if (p && p.length >= 8) rawContacts.push({ phone: p, name: c.name || c.notify || c.verifiedName || '', jid: c.id || '' });
        }
      }
    } catch (e) { console.log('[AutoSync] Store error:', e.message); }
  }

  // 4) Read contacts.json from disk directly
  if (!rawContacts.length) {
    const diskContacts = readContactsFromDisk(sessionId);
    console.log('[AutoSync] Disk contacts:', diskContacts.length);
    for (const c of diskContacts) {
      if (c.phone && c.phone.length >= 8) rawContacts.push(c);
    }
  }

  // 5) Last resort: try to extract from sock.chats / store.chats (JID -> phone)
  if (!rawContacts.length) {
    try {
      const sock = whatsappService.sessions?.get?.(sessionId);
      let chats = [];
      if (sock?.store?.chats) {
        const store = sock.store.chats;
        if (store instanceof Map) chats = Array.from(store.keys());
        else if (Array.isArray(store)) chats = store.map(c => c.id).filter(Boolean);
        else if (typeof store === 'object') chats = Object.keys(store);
      }
      if (sock?.chats) {
        if (sock.chats instanceof Map) chats = [...chats, ...Array.from(sock.chats.keys())];
        else if (Array.isArray(sock.chats)) chats = [...chats, ...sock.chats.map(c => c.id).filter(Boolean)];
        else if (typeof sock.chats === 'object') chats = [...chats, ...Object.keys(sock.chats)];
      }
      chats = [...new Set(chats)].filter(jid => jid && !jid.includes('@g.us') && !jid.includes('@broadcast'));
      console.log('[AutoSync] Chat JIDs (non-group):', chats.length);
      for (const jid of chats) {
        const p = jid.split('@')[0];
        if (p && p.length >= 8) rawContacts.push({ phone: p, name: '', jid });
      }
    } catch (e) { console.log('[AutoSync] Chats error:', e.message); }
  }

  // 6) FINAL resort: fetch all participating groups and extract members (concurrent, max 20)
  if (!rawContacts.length) {
    try {
      const sock = whatsappService.sessions?.get?.(sessionId);
      if (sock?.groupFetchAllParticipating) {
        console.log('[AutoSync] Fetching all groups to extract members...');
        const groupsMap = await sock.groupFetchAllParticipating();
        const groupIds = Object.keys(groupsMap || {}).slice(0, 20);
        console.log('[AutoSync] Found', Object.keys(groupsMap || {}).length, 'groups, processing', groupIds.length);
        await Promise.allSettled(groupIds.map(gid =>
          sock.groupMetadata(gid).then(meta => {
            for (const p of meta.participants || []) {
              const jid = p.id || p.jid || '';
              const phone = jid.split('@')[0];
              if (phone && phone.length >= 8) {
                rawContacts.push({ phone, name: p.name || p.pushName || '', jid, group: meta.subject || '' });
              }
            }
          }).catch(() => {})
        ));
        console.log('[AutoSync] Extracted', rawContacts.length, 'contacts from groups');
      }
    } catch (e) { console.log('[AutoSync] Group extraction error:', e.message); }
  }

  if (!rawContacts.length) {
    console.log('[AutoSync] No raw contacts found from ANY source');
    return 0;
  }

  // Deduplicate by phone (last 10 digits)
  const seen = new Set();
  const unique = [];
  for (const c of rawContacts) {
    const key = c.phone.replace(/[^0-9]/g, '').slice(-10);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }
  console.log('[AutoSync] Unique contacts to save:', unique.length);

  // Bulk upsert into MongoDB in chunks of 500
  const chunkSize = 500;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const ops = chunk.map(c => ({
      updateOne: {
        filter: { userId, phone: c.phone },
        update: {
          $setOnInsert: { userId, tenantId, phone: c.phone, name: c.name || '', source: 'whatsapp_sync', createdAt: new Date() },
          $set: { updatedAt: new Date() }
        },
        upsert: true
      }
    }));
    try {
      const result = await Contact.bulkWrite(ops, { ordered: false });
      syncedCount += (result.upsertedCount || 0) + (result.modifiedCount || 0);
    } catch (e) { console.log('[AutoSync] Bulk write chunk error:', e.message); }
  }

  console.log('[AutoSync] Synced', syncedCount, 'contacts to MongoDB for session', sessionId);
  return syncedCount;
};

// ---------------------------------------------------------------------------
// Collect contacts from ALL possible sources (read-only, no DB writes)
// ---------------------------------------------------------------------------
const collectSessionContacts = async (sessionId, userId) => {
  const results = { sources: {}, all: new Map() };

  // Source 1: Direct socket contacts (sock.contacts — THE authoritative Baileys contact list)
  // MUST be first — this is what Baileys knows from auth state + server sync
  try {
    const sock = whatsappService.sessions?.get?.(sessionId);
    if (sock?.contacts) {
      let entries = [];
      if (sock.contacts instanceof Map) {
        for (const [jid, c] of sock.contacts) {
          if (jid && !jid.includes('@g.us')) entries.push([jid, c]);
        }
      } else if (typeof sock.contacts === 'object') {
        entries = Object.entries(sock.contacts).filter(([j]) => j && !j.includes('@g.us'));
      }
      results.sources.socketContacts = entries.length;
      for (const [, c] of entries) {
        const p = c.id?.split('@')[0] || '';
        if (!p || results.all.has(p)) continue;
        results.all.set(p, { name: c.name || c.notify || c.verifiedName || '', group: 'WhatsApp Contacts', phone: p });
      }
    }
  } catch (e) { results.sources.socketContactsError = e.message; }

  // Source 2: GroupScrape participants
  const scrapes = await GroupScrape.find({ sessionId })
    .select('sessionId groupJid groupName groupSubject participants totalMembers')
    .sort({ createdAt: -1 })
    .lean();
  results.sources.groupScrapes = scrapes.length;
  let fromScrapes = 0;
  for (const scrape of scrapes) {
    for (const m of scrape.participants || []) {
      const p = m.phone || (m.jid ? m.jid.split('@')[0] : '');
      if (!p || results.all.has(p)) continue;
      results.all.set(p, { name: m.name || '', group: scrape.groupName || scrape.groupSubject || 'Group', phone: p });
      fromScrapes++;
    }
  }
  results.sources.fromScrapes = fromScrapes;

  // Source 3: getAllContacts (Baileys sessionsContactMap — populated by events, may have extra names)
  try {
    const waContacts = await whatsappService.getAllContacts(sessionId);
    results.sources.waContacts = waContacts.length;
    for (const c of waContacts) {
      if (!c.phone || results.all.has(c.phone)) continue;
      results.all.set(c.phone, { name: c.name || '', group: 'WhatsApp Contacts', phone: c.phone });
    }
  } catch (e) { results.sources.waContactsError = e.message; }

  // Source 4: Baileys store contacts (if available)
  try {
    const sock = whatsappService.sessions?.get?.(sessionId);
    if (sock?.store?.contacts) {
      const store = sock.store.contacts;
      let entries = [];
      if (store instanceof Map) {
        for (const [jid, c] of store) {
          if (jid && !jid.includes('@g.us')) entries.push([jid, c]);
        }
      } else if (typeof store === 'object') {
        entries = Object.entries(store).filter(([j]) => j && !j.includes('@g.us'));
      }
      results.sources.storeContacts = entries.length;
      for (const [, c] of entries) {
        const p = c.id?.split('@')[0] || '';
        if (!p || results.all.has(p)) continue;
        results.all.set(p, { name: c.name || c.notify || c.verifiedName || '', group: 'WhatsApp Contacts', phone: p });
      }
    }
  } catch (e) { results.sources.storeContactsError = e.message; }

  // Source 5: Saved MongoDB contacts (userId match)
  try {
    const savedContacts = await Contact.find({ userId }).lean();
    results.sources.savedContacts = savedContacts.length;
    for (const c of savedContacts) {
      const p = c.phone;
      if (!p) continue;
      if (results.all.has(p)) {
        const ex = results.all.get(p);
        if (c.name && !ex.name) ex.name = c.name;
        if (c.address) ex.address = c.address;
      } else {
        results.all.set(p, { name: c.name || '', group: 'Saved Contacts', phone: p, address: c.address || c.city || '' });
      }
    }
  } catch (e) { results.sources.savedContactsError = e.message; }

  // Source 6: Imported contacts (source=scrape)
  try {
    const importedContacts = await Contact.find({ userId, source: 'scrape' }).lean();
    results.sources.importedContacts = importedContacts.length;
    for (const c of importedContacts) {
      const p = c.phone;
      if (!p || results.all.has(p)) continue;
      results.all.set(p, { name: c.name || '', group: 'Imported Contacts', phone: p, address: c.address || c.city || '' });
    }
  } catch (e) { /* skip */ }

  // Source 7: contacts.json from disk (persisted by Baileys events)
  if (results.total === 0) {
    try {
      const diskContacts = readContactsFromDisk(sessionId);
      results.sources.diskContacts = diskContacts.length;
      for (const c of diskContacts) {
        const p = c.phone;
        if (!p || results.all.has(p)) continue;
        results.all.set(p, { name: c.name || '', group: 'WhatsApp Contacts (Disk)', phone: p });
      }
    } catch (e) { results.sources.diskContactsError = e.message; }
  }

  // Source 8: Fetch all participating groups and extract members (concurrent, max 20 groups)
  if (results.total === 0) {
    try {
      const sock = whatsappService.sessions?.get?.(sessionId);
      if (sock?.groupFetchAllParticipating) {
        console.log('[CollectContacts] Fetching all groups for contacts...');
        const groupsMap = await sock.groupFetchAllParticipating();
        const groupIds = Object.keys(groupsMap || {}).slice(0, 20);
        console.log('[CollectContacts] Found', Object.keys(groupsMap || {}).length, 'groups, processing', groupIds.length);
        let groupContactCount = 0;
        await Promise.allSettled(groupIds.map(gid =>
          sock.groupMetadata(gid).then(meta => {
            for (const p of meta.participants || []) {
              const jid = p.id || p.jid || '';
              const phone = jid.split('@')[0];
              if (phone && phone.length >= 8 && !results.all.has(phone)) {
                const name = p.name || p.pushName || '';
                results.all.set(phone, { name, group: meta.subject || 'WhatsApp Group', phone });
                groupContactCount++;
              }
            }
          }).catch(() => {})
        ));
        results.sources.groupMembers = groupContactCount;
        console.log('[CollectContacts] Extracted', groupContactCount, 'contacts from groups');
      }
    } catch (e) { results.sources.groupMembersError = e.message; }
  }

  results.total = results.all.size;
  return results;
};

// ---------------------------------------------------------------------------
// GET /api/debug/session/:sessionId  —  rich diagnostics
// ---------------------------------------------------------------------------
exports.getSessionDebug = async (req, res) => {
  const sessionId = String(req.params.id || '').trim();
  try {
    const session = await Session.findOne({ sessionId }).select('sessionId status qr createdAt updatedAt').lean();
    const sock = whatsappService.sessions?.get?.(sessionId);

    // Count contacts in MongoDB
    const contactsCount = await Contact.countDocuments({ userId: req.user._id });
    const scrapedContactsCount = await Contact.countDocuments({ userId: req.user._id, source: 'scrape' });
    const groupScrapes = await GroupScrape.find({ sessionId }).lean();
    const groupMembersCount = groupScrapes.reduce((sum, s) => sum + (s.participants?.length || 0), 0);

    // List all MongoDB collection names
    const collections = await mongoose.connection.db?.listCollections().toArray() || [];
    const databaseCollections = collections.map(c => c.name).sort();

    // Live WhatsApp store contacts count
    let storeContactsCount = 0;
    if (sock?.store?.contacts) {
      const store = sock.store.contacts;
      if (store instanceof Map) storeContactsCount = store.size;
      else if (typeof store === 'object') storeContactsCount = Object.keys(store).length;
    }

    // Socket contacts count
    let socketContactsCount = 0;
    if (sock?.contacts) {
      if (sock.contacts instanceof Map) socketContactsCount = sock.contacts.size;
      else if (typeof sock.contacts === 'object') socketContactsCount = Object.keys(sock.contacts).length;
    }

    res.json({
      success: true,
      sessionId,
      sessionExists: !!session,
      connected: sock?.user ? true : false,
      dbStatus: session?.status || 'unknown',
      contactsCount: contactsCount || 0,
      scrapedContactsCount: scrapedContactsCount || 0,
      groupMembersCount: groupMembersCount || 0,
      storeContactsCount: storeContactsCount || 0,
      socketContactsCount: socketContactsCount || 0,
      databaseCollections
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/sessions/:sessionId/contacts/count
// ---------------------------------------------------------------------------
exports.getContactCount = async (req, res) => {
  const sessionId = String(req.params.id || '').trim();
  try {
    const count = await Contact.countDocuments({ userId: req.user._id });
    const scrapedCount = await Contact.countDocuments({ userId: req.user._id, source: 'scrape' });
    const groupScrapes = await GroupScrape.find({ sessionId }).lean();
    const groupMembers = groupScrapes.reduce((sum, s) => sum + (s.participants?.length || 0), 0);
    res.json({ success: true, count: count + groupMembers, dbContacts: count, scrapedContacts: scrapedCount, groupMembers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/sessions/:sessionId/contacts/export  —  export with auto-sync
// ---------------------------------------------------------------------------
exports.exportContacts = async (req, res) => {
  const sessionId = String(req.params.id || '').trim();
  const format = normalizeExportFormat(req.query.format || req.params.format);
  const startTime = Date.now();

  console.log('[ExportContacts] ====== START ======', { sessionId, format, userId: req.user?._id?.toString() });

  // Overall timeout: 55s so frontend 120s timeout doesn't fire first
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Export timed out after 55s')), 55000)
  );

  const exportPromise = (async () => {
    if (!sessionId || sessionId.length < 3 || sessionId.length > 256) {
      return res.status(422).json({ success: false, message: 'Invalid session ID format' });
    }

    const tenantId = req.tenant?._id || req.user?.tenantId;
    const sessionFilter = { sessionId };
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') sessionFilter.userId = req.user._id;
    if (tenantId) sessionFilter.tenantId = tenantId;

    const session = await Session.findOne(sessionFilter).lean();
    console.log('[ExportContacts] Session found:', !!session, 'Status:', session?.status);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found or access denied' });
    }

    // Phase 0: Wait for Baileys to sync contacts (up to 20s, need at least 5 contacts)
    if (session.status === 'connected') {
      console.log('[ExportContacts] Phase 0: waiting for contact sync...');
      const syncedCount = await whatsappService.waitForContactSync(sessionId, 5, 20000);
      console.log('[ExportContacts] Phase 0 done:', syncedCount, 'contacts synced');
    }

    // Phase 1: collect from all existing sources (DB + scrapes + in-memory)
    let collected = await collectSessionContacts(sessionId, req.user._id);
    console.log('[ExportContacts] Phase 1 collection:', collected.total, 'sources:', collected.sources);

    // Phase 2: if empty and connected, auto-sync Baileys store contacts to MongoDB
    if (collected.total === 0 && session.status === 'connected') {
      console.log('[ExportContacts] Phase 2: auto-syncing Baileys contacts to MongoDB...');
      const synced = await autoSyncContactsToDb(sessionId, req.user._id, tenantId);
      console.log('[ExportContacts] Auto-sync result:', synced, 'contacts saved');
      if (synced > 0) {
        collected = await collectSessionContacts(sessionId, req.user._id);
        console.log('[ExportContacts] Phase 2 collection after sync:', collected.total);
      }
    }

    // Phase 3: supplementary direct read from sock.contacts + store (always run, even if we have contacts)
    // This catches any contacts that events haven't populated into sessionsContactMap yet
    if (session.status === 'connected') {
      console.log('[ExportContacts] Phase 3: supplementary direct socket read...');
      const sock = whatsappService.sessions?.get?.(sessionId);
      let added = 0;

      // Pre-merge sock.contacts directly (most authoritative source)
      if (sock?.contacts) {
        const contacts = sock.contacts instanceof Map ? sock.contacts : typeof sock.contacts === 'object' ? Object.entries(sock.contacts) : [];
        if (sock.contacts instanceof Map) {
          for (const [jid, c] of sock.contacts) {
            if (jid && !jid.includes('@g.us')) {
              const p = c.id?.split('@')[0] || jid.split('@')[0];
              if (!p || collected.all.has(p)) continue;
              collected.all.set(p, { name: c.name || c.notify || c.verifiedName || '', group: 'WhatsApp Contacts', phone: p, admin: '-', sessionId, groupJid: jid, scrapedAt: '', address: '' });
              added++;
            }
          }
        } else if (typeof sock.contacts === 'object') {
          for (const [jid, c] of Object.entries(sock.contacts)) {
            if (jid && !jid.includes('@g.us')) {
              const p = c.id?.split('@')[0] || jid.split('@')[0];
              if (!p || collected.all.has(p)) continue;
              collected.all.set(p, { name: c.name || c.notify || c.verifiedName || '', group: 'WhatsApp Contacts', phone: p, admin: '-', sessionId, groupJid: jid, scrapedAt: '', address: '' });
              added++;
            }
          }
        }
      }

      // Also merge in store contacts
      if (sock?.store?.contacts) {
        const store = sock.store.contacts;
        const entries = store instanceof Map ? [...store] : typeof store === 'object' ? Object.entries(store) : [];
        for (const [jid, c] of entries) {
          if (!jid || jid.includes('@g.us')) continue;
          const p = c.id?.split('@')[0] || jid.split('@')[0];
          if (!p || collected.all.has(p)) continue;
          collected.all.set(p, { name: c.name || c.notify || c.verifiedName || '', group: 'WhatsApp Contacts', phone: p, admin: '-', sessionId, groupJid: jid, scrapedAt: '', address: '' });
          added++;
        }
      }

      if (added > 0) {
        collected.total = collected.all.size;
        console.log('[ExportContacts] Phase 3 added', added, 'more contacts, total:', collected.total);
      } else {
        console.log('[ExportContacts] Phase 3: no new contacts from direct socket read');
      }
    }

    const finalContacts = Array.from(collected.all.values()).map(c => ({
      ...c, admin: c.admin || '-', sessionId, groupJid: c.groupJid || '', scrapedAt: c.scrapedAt || '', address: c.address || ''
    }));

    console.log('[ExportContacts] Final contacts count:', finalContacts.length, 'Session:', sessionId);

    if (!finalContacts.length) {
      console.log('[ExportContacts] No contacts from ANY source after all fallbacks');
      return res.status(404).json({
        success: false,
        message: 'No contacts found to export after checking all sources (DB, scrapes, Baileys store, socket).',
        diagnostics: collected.sources
      });
    }

    console.log('[ExportContacts] Generating', format, 'file for', finalContacts.length, 'contacts');
    await sendContactExport(res, finalContacts, { format, filenameBase: `contacts-${sessionId}` });

    console.log('[ExportContacts] ====== SUCCESS ======', {
      sessionId, format, contactCount: finalContacts.length, durationMs: Date.now() - startTime
    });
  })();

  await Promise.race([exportPromise, timeoutPromise]);
  } catch (err) {
    console.error('[ExportContacts] Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
