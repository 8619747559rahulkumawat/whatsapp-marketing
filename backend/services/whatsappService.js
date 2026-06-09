require('dotenv').config();
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers, fetchLatestBaileysVersion, fetchLatestWaWebVersion, downloadMediaMessage, extractMessageContent, getContentType } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Session = require('../models/Session');
const pino = require('pino');
const { formatPhoneNumber } = require('../utils/helpers');

// Connectivity check on load
const https = require('https');
const dns = require('dns');
const checkConnectivity = () => {
  const targets = [
    { name: 'web.whatsapp.com', type: 'https' },
    { name: 'raw.githubusercontent.com', type: 'https' },
    { name: 'ws.whatsapp.net', type: 'https' },
  ];
  targets.forEach(({ name }) => {
    dns.resolve(name, (err) => {
      if (err) console.warn(`[Connectivity] DNS FAILED for ${name}:`, err.code);
      else {
        const req = https.get(`https://${name}/`, { timeout: 8000 }, (res) => {
          console.log(`[Connectivity] ${name} reachable (status ${res.statusCode})`);
          res.destroy();
        });
        req.on('error', (e) => console.warn(`[Connectivity] ${name} HTTPS FAILED:`, e.message));
        req.on('timeout', () => { req.destroy(); console.warn(`[Connectivity] ${name} HTTPS TIMEOUT`); });
      }
    });
  });
  // Check WhatsApp Web service worker (used for version detection)
  dns.resolve('web.whatsapp.com', (err) => {
    if (!err) {
      const req = https.get('https://web.whatsapp.com/sw.js', { timeout: 8000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          const match = data.match(/client_revision["']?\s*:\s*(\d+)/);
          if (match) console.log(`[Connectivity] WA Web sw.js client_revision: ${match[1]}`);
          else console.warn(`[Connectivity] Could not extract client_revision from sw.js`);
        });
      });
      req.on('error', (e) => console.warn(`[Connectivity] sw.js fetch FAILED:`, e.message));
      req.on('timeout', () => { req.destroy(); console.warn(`[Connectivity] sw.js fetch TIMEOUT`); });
    }
  });
};
checkConnectivity();

const sessions = new Map();
const sessionsContactMap = new Map();
const reconnectTimers = new Map();
const reconnectAttempts = new Map();
const healthCheckers = new Map();
const healthFailures = new Map();
const connectingSessions = new Map(); // sessionId -> startTime (Date.now())
const reconnectPromises = new Map();
const MAX_RECONNECT_DELAY = 60000;
const MAX_RECONNECT_ATTEMPTS = 30;
const RECONNECT_POLL_TIMEOUT = 60000;
const RECONNECT_POLL_INTERVAL = 1000;
const CONNECTION_STALE_TIMEOUT = 120000; // 120s max for a connection attempt
let globalIo = null;
let savedVersion = null;

// Keep-alive HTTPS agent for Baileys WebSocket connections (helps on free Render/AWS)
const baileysAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 120000
});

const STOP_KEYWORDS = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END'];
const START_KEYWORDS = ['START', 'YES', 'UNSTOP', 'SUBSCRIBE'];

const processInboundConsentKeyword = async ({ tenantId, userId, phone, message }) => {
  const keyword = (message || '').trim().toUpperCase();
  if (!keyword) return null;

  let type = null;
  if (STOP_KEYWORDS.includes(keyword)) type = 'opt_out';
  if (START_KEYWORDS.includes(keyword)) type = 'opt_in';
  if (!type) return null;

  try {
    const Contact = require('../models/Contact');
    const Compliance = require('../models/Compliance');
    const formattedPhone = formatPhoneNumber(phone);
    const contact = await Contact.findOne({ tenantId, phone: formattedPhone });
    if (!contact) {
      console.log(`[Compliance] ${keyword} received from ${formattedPhone}, but no matching contact was found.`);
      return null;
    }

    const record = await Compliance.create({
      tenantId,
      userId: contact.userId || userId,
      contactId: contact._id,
      type,
      phone: formattedPhone,
      method: 'keyword',
      keyword,
      details: {
        originalMessage: message,
        processedFrom: 'whatsapp_inbound'
      },
      processed: true,
      processedAt: new Date()
    });

    if (type === 'opt_out') {
      await Contact.findByIdAndUpdate(contact._id, {
        isBlacklisted: true,
        blacklistReason: `Opted out via keyword: ${keyword}`
      });
    } else {
      await Contact.findByIdAndUpdate(contact._id, {
        isBlacklisted: false,
        blacklistReason: ''
      });
    }

    console.log(`[Compliance] Processed ${type} keyword ${keyword} for ${formattedPhone}`);
    return record;
  } catch (err) {
    console.error('[Compliance] Keyword processing failed:', err.message);
    return null;
  }
};

// ==========================================
// ANTI-BAN HELPERS
// ==========================================

// 1. Spintax Randomizer: {Hi|Hello|Hey} -> Randomly selects one
const replaceSpintax = (text) => {
  if (!text) return '';
  return text.replace(/{([^{}]+)}/g, (match, choices) => {
    const arr = choices.split('|');
    return arr[Math.floor(Math.random() * arr.length)];
  });
};

// 2. Random delay between messages (15-30 seconds default)
const randomDelay = (minSeconds = 15, maxSeconds = 30) => {
  const secs = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds);
  console.log(`[AntiBan] Waiting ${secs}s before next message...`);
  return new Promise(resolve => setTimeout(resolve, secs * 1000));
};

// 3. Typing Emulation: Mimics human typing/recording state
const emulateHumanActivity = async (sock, jid, mediaType = 'text') => {
  try {
    const presenceState = mediaType === 'audio' ? 'recording' : 'composing';
    console.log(`[AntiBan] Typing... for ${jid}`);
    await sock.sendPresenceUpdate(presenceState, jid);
    
    // Hold typing for exactly 3 seconds (human typing speed)
    await new Promise(r => setTimeout(r, 3000));
    
    await sock.sendPresenceUpdate('paused', jid);
  } catch (err) {
    // Fail silently so the message still sends if presence update errors out
    console.log('[AntiBan] Presence update failed, skipping...');
  }
};

// ==========================================
// CORE BAILEYS SERVICES
// ==========================================

const getBaileysVersion = async () => {
  try {
    const { version } = await fetchLatestBaileysVersion();
    console.log(`[Baileys] Using version from fetchLatestBaileysVersion:`, version);
    return version;
  } catch (err) {
    console.error('[Baileys] fetchLatestBaileysVersion failed:', err.message);
  }
  try {
    const { version, isLatest } = await fetchLatestWaWebVersion();
    if (isLatest) {
      console.log(`[Baileys] Using version from fetchLatestWaWebVersion:`, version);
      return version;
    }
  } catch (err) {
    console.error('[Baileys] fetchLatestWaWebVersion failed:', err.message);
  }
  const defaultVer = [2, 3000, 1035194821];
  console.warn(`[Baileys] Using fallback version:`, defaultVer);
  return defaultVer;
};

const getSessionDir = (sessionId) => {
  const dir = path.join(process.cwd(), process.env.SESSIONS_DIR || 'sessions', sessionId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const isSessionConnected = (sessionId) => {
  const sock = sessions.get(sessionId);
  return sock && sock.user ? true : false;
};

const isSessionReady = (sessionId) => {
  const sock = sessions.get(sessionId);
  return sock && sock.user ? true : false;
};

const getConnectionStatus = async (sessionId) => {
  const sock = sessions.get(sessionId);
  if (sock && sock.user) return { status: 'connected', phone: sock.user.id.split(':')[0] };
  try {
    const Session = require('../models/Session');
    const dbSession = await Session.findOne({ sessionId }).select('status phone errorMessage errorDetails');
    if (dbSession) {
      return {
        status: dbSession.status || 'disconnected',
        phone: dbSession.phone || '',
        errorMessage: dbSession.errorMessage || '',
        errorDetails: dbSession.errorDetails || null
      };
    }
  } catch (err) { console.error("WhatsApp Error:", err); }
  if (sock) return { status: 'connecting', phone: '' };
  return { status: 'disconnected', phone: '', errorMessage: '', errorDetails: null };
};

const cleanupSession = (sessionId) => {
  if (reconnectTimers.has(sessionId)) {
    clearTimeout(reconnectTimers.get(sessionId));
    reconnectTimers.delete(sessionId);
  }
  if (healthCheckers.has(sessionId)) {
    clearInterval(healthCheckers.get(sessionId));
    healthCheckers.delete(sessionId);
  }
  healthFailures.delete(sessionId);
  reconnectPromises.delete(sessionId);
  sessionsContactMap.delete(sessionId);
  const oldSock = sessions.get(sessionId);
  if (oldSock) {
    try { oldSock.ev?.removeAllListeners?.(); } catch (err) { console.error("WhatsApp Error:", err); }
    try { oldSock.end(new Error('Session replaced')); } catch (err) { console.error("WhatsApp Error:", err); }
  }
  sessions.delete(sessionId);
};

const connectSession = async (sessionId, io) => {
  // Check for stale connection attempts
  if (connectingSessions.has(sessionId)) {
    const startedAt = connectingSessions.get(sessionId);
    if (Date.now() - startedAt < CONNECTION_STALE_TIMEOUT) return;
    console.log(`[Baileys] Session ${sessionId} connection attempt stale (${Date.now() - startedAt}ms), restarting...`);
    connectingSessions.delete(sessionId);
  }
  connectingSessions.set(sessionId, Date.now());
  if (io) globalIo = io;
  try {
    // Fetch session FIRST so it's available for event handlers (before any awaits after makeWASocket)
    const session = await Session.findOne({ sessionId });
    if (!session) {
      throw new Error('Session not found in database');
    }

    cleanupSession(sessionId);

    const sessionDir = getSessionDir(sessionId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    console.log(`[Baileys] Connecting session ${sessionId}...`);
    const version = await getBaileysVersion();

    const sock = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      logger: pino({ level: 'warn' }),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      version,
      keepAliveIntervalMs: 10000,
      connectTimeoutMs: 120000,
      defaultQueryTimeoutMs: 180000,
      maxRetries: 2,
      emitOwnEvents: true,
      agent: baileysAgent
    });

    savedVersion = version;
    sessions.set(sessionId, sock);
    sessionsContactMap.set(sessionId, new Map());
    console.log(`[Baileys] Socket created for ${sessionId} (version: ${version.join('.')})`);

    // Register connection.update handler IMMEDIATELY after makeWASocket, before any await
    // This prevents missing QR events that fire during async operations
    sock.ev.on('connection.update', async (update) => {
      try {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log(`[Baileys] QR generated for session ${sessionId}, emitting to client`);
          let qrDataUrl = '';
          try {
            qrDataUrl = await qrcode.toDataURL(qr);
          } catch (qrErr) {
            console.error(`[Baileys] qrcode.toDataURL failed for ${sessionId}:`, qrErr.message);
            qrDataUrl = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-size="14">${qr.slice(0, 50)}</text></svg>`)}`;
          }
          session.qrCode = qrDataUrl;
          session.qr = qrDataUrl;
          session.status = 'connecting';
          try { await session.save(); } catch (saveErr) { console.error(`[Baileys] Session save error for ${sessionId}:`, saveErr.message); }
          const eventIo = io || globalIo;
          if (eventIo) {
            eventIo.to(`session_${sessionId}`).emit('qr:generated', { sessionId, qr: qrDataUrl, qrRaw: qr });
            eventIo.emit('session:update', { sessionId, status: 'connecting' });
          }
        } else if (update.hasQR === false && !update.connection) {
          console.log(`[Baileys] Session ${sessionId} update (no QR yet):`, JSON.stringify(update));
        }

        if (connection === 'open') {
          connectingSessions.delete(sessionId);
          reconnectAttempts.delete(sessionId);
          session.status = 'connected';
          session.qrCode = ''; session.qr = '';
          session.errorMessage = ''; session.errorDetails = null; session.lastErrorAt = null;
          session.phone = sock.user?.id?.split(':')[0] || '';
          session.lastSynced = new Date();
          await session.save();
          const eventIo = io || globalIo;
          if (eventIo) {
            eventIo.to(`session_${sessionId}`).emit('session:connected', { sessionId });
            eventIo.emit('session:update', { sessionId, status: 'connected', phone: session.phone });
          }
          console.log(`[Baileys] Session ${sessionId} connected!`);

          // Populate contacts from sock.contacts immediately after connection
          try {
            const s = sessions.get(sessionId);
            if (s?.contacts) {
              const cmap = sessionsContactMap.get(sessionId);
              if (cmap) {
                let entries = [];
                if (s.contacts instanceof Map) {
                  for (const [jid, c] of s.contacts) {
                    if (jid && !jid.includes('@g.us')) entries.push([jid, c]);
                  }
                } else if (typeof s.contacts === 'object') {
                  entries = Object.entries(s.contacts).filter(([jid]) => jid && !jid.includes('@g.us'));
                }
                for (const [jid, c] of entries) cmap.set(jid, c);
                if (entries.length > 0) {
                  const cFile = path.join(getSessionDir(sessionId), 'contacts.json');
                  const existing = fs.existsSync(cFile) ? JSON.parse(fs.readFileSync(cFile, 'utf8')) : {};
                  for (const [jid, c] of entries) existing[jid] = c;
                  fs.writeFileSync(cFile, JSON.stringify(existing));
                  console.log(`[Baileys] Immediately populated ${entries.length} contacts for ${sessionId} from sock.contacts`);
                }
              }
            }
          } catch (e) { console.error('[Baileys] Contact population error:', e.message); }

          if (!healthCheckers.has(sessionId)) {
            healthCheckers.set(sessionId, setInterval(async () => {
              if (reconnectTimers.has(sessionId) || connectingSessions.has(sessionId)) return;
              const s = sessions.get(sessionId);
              if (!s || !s.user) return;
            }, 30000));
          }
        }

        if (connection === 'close') {
          // Clear connecting state so reconnect or waitForSessionQr can attempt a fresh connection
          connectingSessions.delete(sessionId);

          const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.data?.reason || lastDisconnect?.error?.message;
          const reason = typeof statusCode === 'number' ? statusCode : DisconnectReason.connectionClosed;

          // Store diagnostic error info
          const errMsg = lastDisconnect?.error?.message || lastDisconnect?.error?.output?.payload?.message || '';
          const errStack = lastDisconnect?.error?.stack || '';
          const errData = lastDisconnect?.error?.data || {};
          session.errorMessage = `[${reason}] ${errMsg}`;
          session.errorDetails = {
            reason,
            statusCode: typeof statusCode === 'number' ? statusCode : undefined,
            message: errMsg.slice(0, 500),
            stack: errStack.slice(0, 1000),
            data: typeof errData === 'object' ? JSON.stringify(errData).slice(0, 500) : String(errData).slice(0, 500)
          };
          session.lastErrorAt = new Date();

          const currentAttempts = reconnectAttempts.get(sessionId) || 0;
          if (reason === DisconnectReason.connectionReplaced) {
            const currentSock = sessions.get(sessionId);
            if (currentSock !== sock) {
              console.log(`[Baileys] Ignoring stale ${reason} event for ${sessionId} - new socket exists`);
              return;
            }
            sessions.delete(sessionId);
            session.status = 'disconnected';
            session.qrCode = ''; session.qr = '';
            await session.save();
            reconnectAttempts.delete(sessionId);
            const eventIo = io || globalIo;
            if (eventIo) {
              eventIo.to(`session_${sessionId}`).emit('session:disconnected', { sessionId, reason, needsQR: false });
              eventIo.emit('session:update', { sessionId, status: 'disconnected' });
            }
            console.log(`[Baileys] Session ${sessionId} was replaced by another connection. Credentials kept for reconnect.`);
          } else if (reason === DisconnectReason.loggedOut) {
            const currentSock = sessions.get(sessionId);
            if (currentSock !== sock) {
              console.log(`[Baileys] Ignoring stale ${reason} event for ${sessionId} - new socket exists`);
              return;
            }
            sessions.delete(sessionId);
            session.status = 'disconnected';
            session.qrCode = ''; session.qr = '';
            await session.save();
            reconnectAttempts.delete(sessionId);
            const sessionDir = getSessionDir(sessionId);
            const credsPath = path.join(sessionDir, 'creds.json');
            if (fs.existsSync(credsPath)) {
              try { fs.unlinkSync(credsPath); } catch (e) { /* ignore */ }
              console.log(`[Baileys] Deleted invalid creds for ${sessionId} - QR re-scan required`);
            }
            const eventIo = io || globalIo;
            if (eventIo) {
              eventIo.to(`session_${sessionId}`).emit('session:disconnected', { sessionId, reason, needsQR: true });
              eventIo.emit('session:update', { sessionId, status: 'disconnected' });
            }
            console.log(`[Baileys] Session ${sessionId} ended (reason: ${reason}), not reconnecting`);
          } else if (currentAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.log(`[Baileys] Session ${sessionId} max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached, giving up`);
            sessions.delete(sessionId);
            session.status = 'disconnected';
            session.qrCode = ''; session.qr = '';
            await session.save();
            reconnectAttempts.delete(sessionId);
            const eventIo = io || globalIo;
            if (eventIo) {
              eventIo.to(`session_${sessionId}`).emit('session:disconnected', { sessionId, reason: 'max_retries' });
              eventIo.emit('session:update', { sessionId, status: 'disconnected' });
            }
          } else {
            const currentSock = sessions.get(sessionId);
            if (currentSock === sock) sessions.delete(sessionId);
            session.status = 'connecting';
            await session.save();
            const baseDelay = reason === DisconnectReason.timedOut || reason === DisconnectReason.connectionClosed ? 5000 : 2000;
            const delay = Math.min(baseDelay * Math.pow(2, currentAttempts), MAX_RECONNECT_DELAY);
            console.log(`[Baileys] Session ${sessionId} closed (reason: ${reason}), reconnecting in ${delay}ms (attempt ${currentAttempts + 1})`);
            reconnectAttempts.set(sessionId, currentAttempts + 1);
            if (reconnectTimers.has(sessionId)) clearTimeout(reconnectTimers.get(sessionId));
            reconnectTimers.set(sessionId, setTimeout(() => connectSession(sessionId, io).catch(e => console.error(`[Baileys] ${sessionId} reconnect timer error:`, e.message)), delay));
          }
        }
      } catch (err) {
        console.error(`[Baileys] ${sessionId} connection.update error:`, err);
      }
    });

    sock.ev.on('messaging-history.set', ({ contacts }) => {
      if (contacts && contacts.length > 0) {
        console.log(`[Baileys] History set for ${sessionId}: ${contacts.length} contacts`);
        const cmap = sessionsContactMap.get(sessionId);
        if (cmap) {
          for (const c of contacts) {
            if (c.id) cmap.set(c.id, c);
          }
        }
        try {
          const contactFile = path.join(getSessionDir(sessionId), 'contacts.json');
          const existing = fs.existsSync(contactFile) ? JSON.parse(fs.readFileSync(contactFile, 'utf8')) : {};
          for (const c of contacts) {
            if (c.id) existing[c.id] = { ...existing[c.id], ...c };
          }
          fs.writeFileSync(contactFile, JSON.stringify(existing));
        } catch (e) { console.error('[Baileys] History contacts persist error:', e.message); }
      }
    });

    sock.ev.on('contacts.upsert', (contacts) => {
      console.log(`[Baileys] Contacts upsert for ${sessionId}: ${contacts?.length} contacts`);
      const cmap = sessionsContactMap.get(sessionId);
      if (cmap) {
        for (const c of contacts) {
          if (c.id) cmap.set(c.id, c);
        }
      }
      try {
        const contactFile = path.join(getSessionDir(sessionId), 'contacts.json');
        const existing = fs.existsSync(contactFile) ? JSON.parse(fs.readFileSync(contactFile, 'utf8')) : {};
        for (const c of contacts) {
          if (c.id) existing[c.id] = c;
        }
        fs.writeFileSync(contactFile, JSON.stringify(existing));
        console.log(`[Baileys] Saved ${Object.keys(existing).length} contacts to ${contactFile}`);
      } catch (e) { console.error('[Baileys] Contact persist error:', e.message); }
    });

    sock.ev.on('contacts.update', (contacts) => {
      const cmap = sessionsContactMap.get(sessionId);
      if (cmap) {
        for (const c of contacts) {
          if (c.id) {
            cmap.set(c.id, cmap.has(c.id) ? { ...cmap.get(c.id), ...c } : c);
          }
        }
      }
      try {
        const contactFile = path.join(getSessionDir(sessionId), 'contacts.json');
        const existing = fs.existsSync(contactFile) ? JSON.parse(fs.readFileSync(contactFile, 'utf8')) : {};
        for (const c of contacts) {
          if (c.id) existing[c.id] = existing[c.id] ? { ...existing[c.id], ...c } : c;
        }
        fs.writeFileSync(contactFile, JSON.stringify(existing));
      } catch (e) { console.error('[Baileys] contacts.update persist error:', e.message); }
    });

    sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0];
      if (!msg.key.fromMe && msg.key.remoteJid && !msg.key.remoteJid.endsWith('@g.us') && !msg.key.remoteJid.endsWith('@broadcast')) {
        try {
          const sess = await Session.findOne({ sessionId });
          if (sess && sess.userId) {
            const Message = require('../models/Message');
            let phone = msg.key.remoteJid.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
            if (msg.key.remoteJid.endsWith('@lid')) {
              const ctx = msg.message?.extendedTextMessage?.contextInfo;
              let sentMsg = null;
              if (ctx?.stanzaId) {
                sentMsg = await Message.findOne({ waMessageId: ctx.stanzaId }).sort({ sentAt: -1 });
              }
              if (!sentMsg) {
                sentMsg = await Message.findOne({ recipientJid: msg.key.remoteJid }).sort({ sentAt: -1 });
              }
              if (!sentMsg) {
                const thirtyMinAgo = new Date(Date.now() - 1800000);
                sentMsg = await Message.findOne({ sessionId, sentAt: { $gte: thirtyMinAgo }, status: { $in: ['sent', 'delivered', 'read'] } }).sort({ sentAt: -1 });
              }
              if (sentMsg) {
                phone = sentMsg.to.replace(/[^0-9]/g, '');
                if (!sentMsg.recipientJid) {
                  await Message.findByIdAndUpdate(sentMsg._id, { recipientJid: msg.key.remoteJid });
                }
              }
            }
            const msgContent = extractMessageContent(msg.message) || {};
            const contentType = getContentType(msgContent) || '';
            let body = msgContent.conversation || msgContent.extendedTextMessage?.text || '';
            let mediaUrl = '';
            
            if (!body && msg.message?.imageMessage) {
              body = msg.message.imageMessage.caption || '📷 Image';
            }
            if (!body && msg.message?.videoMessage) {
              body = msg.message.videoMessage.caption || '🎬 Video';
            }
            if (!body && msg.message?.documentMessage) {
              body = msg.message.documentMessage.caption || `📄 ${msg.message.documentMessage.fileName || 'Document'}`;
            }
            if (!body && msg.message?.audioMessage) {
              body = '🎵 Audio';
            }
            if (contentType === 'imageMessage' && msgContent.imageMessage) {
              body = msgContent.imageMessage.caption || '📷 Image';
            } else if (contentType === 'videoMessage' && msgContent.videoMessage) {
              body = msgContent.videoMessage.caption || '🎬 Video';
            } else if (contentType === 'documentMessage' && msgContent.documentMessage) {
              body = msgContent.documentMessage.caption || `📄 ${msgContent.documentMessage.fileName || 'Document'}`;
            } else if (contentType === 'audioMessage' && msgContent.audioMessage) {
              body = '🎵 Audio';
            }
            if (body?.trim()) {
              await processInboundConsentKeyword({
                tenantId: sess.tenantId,
                userId: sess.userId,
                phone,
                message: body
              });
            }
            if (body) {
              const Chat = require('../models/Chat');
              const clientUser = await require('../models/User').findOne({ phone: { $regex: phone.replace('91', '') } });
              const waName = msg.pushName && msg.pushName !== phone ? msg.pushName : '';
              let mediaType = 'text';
              if (contentType === 'imageMessage') mediaType = 'image';
              else if (contentType === 'videoMessage') mediaType = 'video';
              else if (contentType === 'audioMessage') mediaType = 'audio';
              else if (contentType === 'documentMessage') mediaType = 'document';
              let chat;
              if (clientUser) {
                chat = await Chat.create({
                  senderId: clientUser._id,
                  senderName: clientUser.name,
                  senderRole: 'user',
                  receiverId: sess.userId,
                  message: body,
                  mediaUrl,
                  mediaType,
                  waName,
                  tenantId: clientUser.tenantId
                });
              } else {
                chat = await Chat.create({
                  senderName: waName,
                  senderRole: 'user',
                  receiverId: sess.userId,
                  waPhone: phone,
                  message: body,
                  mediaUrl,
                  mediaType,
                  waName,
                  tenantId: sess.tenantId
                });
              }
              if (chat.mediaType === 'image' && msgContent?.imageMessage) {
                downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage })
                  .then(buffer => {
                    if (buffer) {
                      const ext = msgContent.imageMessage.mimetype?.split('/')[1] || 'jpg';
                      const filename = `${crypto.randomUUID()}.${ext}`;
                      const filePath = path.resolve(__dirname, '..', 'uploads', filename);
                      fs.writeFileSync(filePath, buffer);
                      const url = `/uploads/${filename}`;
                      Chat.findByIdAndUpdate(chat._id, { mediaUrl: url }).catch(() => {});
                    }
                  })
                  .catch(() => {});
              }
              if (sock?.user) {
                const jid = msg.key.remoteJid;
                sock.profilePictureUrl(jid, 'image')
                  .then(url => {
                    if (url) Chat.findByIdAndUpdate(chat._id, { profilePic: url }).catch(() => {});
                  })
                  .catch(() => {});
              }
              if (io) {
                io.to('admin_room').emit('chat:new', chat);
                if (sess.userId) io.to(`user_${sess.userId}`).emit('chat:new', chat);
              }

              // Auto-reply check
              if (body.trim()) {
                try {
                  const AutoReply = require('../models/AutoReply');
                  const rules = await AutoReply.find({ tenantId: sess.tenantId, isActive: true }).lean();
                  for (const rule of rules) {
                    let matched = false;
                    const msgLower = body.toLowerCase().trim();
                    const kwLower = rule.keyword.toLowerCase().trim();
                    if (rule.matchType === 'exact') matched = msgLower === kwLower;
                    else if (rule.matchType === 'contains') matched = msgLower.includes(kwLower);
                    else if (rule.matchType === 'regex') {
                      try { matched = new RegExp(rule.keyword, 'i').test(msgLower); } catch (err) { console.error("WhatsApp Error:", err); }
                    }
                    if (matched) {
                      if (rule.oncePerContact && rule.sentContacts?.includes(phone)) continue;
                      if (rule.sessionId && rule.sessionId !== sessionId) continue;
                      await sock.sendPresenceUpdate('composing', msg.key.remoteJid);
                      await new Promise(r => setTimeout(r, 2000));
                      await sock.sendMessage(msg.key.remoteJid, { text: rule.replyText });
                      await sock.sendPresenceUpdate('paused', msg.key.remoteJid);
                      if (rule.oncePerContact) {
                        await AutoReply.findByIdAndUpdate(rule._id, { $addToSet: { sentContacts: phone } });
                      }
                      console.log(`[AutoReply] Replied to ${phone} with rule: ${rule.name || rule.keyword}`);
                      break;
                    }
                  }
                } catch (arErr) {
                  console.error('[AutoReply] Error:', arErr.message);
                }
              }
            }
          }
        } catch (e) {
          console.error(`[Baileys] Error processing incoming message from ${msg.key.remoteJid}:`, e.message);
        }
      }
      if (io && msg.key.remoteJid && !msg.key.remoteJid.endsWith('@g.us') && !msg.key.remoteJid.endsWith('@broadcast')) {
        io.to(`session_${sessionId}`).emit('message:incoming', {
          sessionId,
          from: msg.key.remoteJid,
          body: msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
        });
      }
    });

    sock.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        try {
          const key = update.key;
          if (key?.id) {
            const waStatus = update.status;
            let dbStatus = 'sent';
            if (waStatus === 'delivered' || waStatus === 'read') dbStatus = 'delivered';
            else if (waStatus === 'failed') dbStatus = 'failed';
            const Message = require('../models/Message');
            const updated = await Message.findOneAndUpdate(
              { waMessageId: key.id },
              { status: dbStatus, ...(dbStatus === 'delivered' ? { deliveredAt: new Date() } : {}) },
              { new: true }
            );
            if (updated && io) {
              io.to(`session_${sessionId}`).emit('message:update', {
                messageId: updated._id,
                waMessageId: key.id,
                status: dbStatus
              });
            }
          }
        } catch (e) { console.error('[Baileys] messages.update error:', e.message); }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('error', (err) => {
      console.error(`[Baileys] ${sessionId} error:`, err.message);
    });

    console.log(`[Baileys] Session ${sessionId} registered`);
  } catch (err) {
    console.error(`[Baileys] Error connecting session ${sessionId}:`, err.message);
    console.error(`[Baileys] Stack:`, err.stack);
    sessions.delete(sessionId);
    await Session.findOneAndUpdate({ sessionId }, {
      status: 'disconnected',
      errorMessage: err.message?.slice(0, 500) || 'Unknown error in connectSession',
      errorDetails: {
        message: err.message?.slice(0, 500),
        stack: err.stack?.slice(0, 1000),
        code: err.code || err.statusCode || undefined
      },
      lastErrorAt: new Date()
    }).catch(() => {});
  } finally {
    connectingSessions.delete(sessionId);
  }
};

// Clean stale connection locks periodically
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, startedAt] of connectingSessions) {
    if (now - startedAt > CONNECTION_STALE_TIMEOUT) {
      console.log(`[Baileys] Cleaning stale connection lock for ${sessionId} (${now - startedAt}ms old)`);
      connectingSessions.delete(sessionId);
    }
  }
}, 30000);

const disconnectSession = async (sessionId) => {
  cleanupSession(sessionId);
  reconnectAttempts.delete(sessionId);
  await Session.findOneAndUpdate({ sessionId }, { status: 'disconnected', qrCode: '', qr: '' });
};

const waitForSessionQr = async (sessionId, io, timeoutMs = 120000) => {
  const eventIo = io || globalIo;
  let session = await Session.findOne({ sessionId });
  if (!session) return null;

  if (session.status === 'connected') {
    return { qr: '', status: 'connected' };
  }

  if (session.qr) {
    return { qr: session.qr, status: session.status === 'connected' ? 'connected' : 'connecting' };
  }

  const sock = sessions.get(sessionId);
  const isConnecting = connectingSessions.has(sessionId);
  const isStale = isConnecting && (Date.now() - connectingSessions.get(sessionId) > CONNECTION_STALE_TIMEOUT);
  if (!sock?.user && (!isConnecting || isStale)) {
    if (isStale) {
      console.log(`[Baileys] ${sessionId} connection attempt stale, restarting...`);
      connectingSessions.delete(sessionId);
    }
    await Session.findOneAndUpdate({ sessionId }, { status: 'connecting' }).catch(() => {});
    connectSession(sessionId, eventIo).catch(err => {
      console.error(`[Baileys] ${sessionId} QR connect error:`, err.message);
    });
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 500));
    session = await Session.findOne({ sessionId }).select('qr status');
    if (!session) return null;
    if (session.qr || session.status === 'connected') {
      const status = session.status === 'connected' ? 'connected' : 'connecting';
      return { qr: session.qr || '', status };
    }
    // Check if connection attempt has died and needs a fresh connect
    const currentSock = sessions.get(sessionId);
    const stillConnecting = connectingSessions.has(sessionId);
    if (!currentSock?.user && !stillConnecting) {
      console.log(`[Baileys] ${sessionId} connection dead, re-triggering connect during QR poll`);
      await Session.findOneAndUpdate({ sessionId }, { status: 'connecting' }).catch(() => {});
      connectSession(sessionId, eventIo).catch(err => {
        console.error(`[Baileys] ${sessionId} poll reconnect error:`, err.message);
      });
    }
  }

  session = await Session.findOne({ sessionId }).select('qr status');
  if (!session) return null;
  return {
    qr: session.qr || '',
    status: session.qr && session.status !== 'connected' ? 'connecting' : (session.status || 'connecting')
  };
};

const removeSession = async (sessionId) => {
  await disconnectSession(sessionId);
  const sessionDir = getSessionDir(sessionId);
  if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
  await Session.findOneAndDelete({ sessionId });
};

const waitForSocketReady = async (sessionId, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const sock = sessions.get(sessionId);
    if (sock && sock.user) return sock;
    await new Promise(r => setTimeout(r, RECONNECT_POLL_INTERVAL));
  }
  return null;
};

const getOrReconnectSocket = async (sessionId, retries = 2) => {
  let sock = sessions.get(sessionId);
  if (sock && sock.user) return sock;

  const pendingPromise = reconnectPromises.get(sessionId);
  if (pendingPromise) {
    const result = await pendingPromise;
    if (result) return result;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const promise = (async () => {
      try {
        sock = sessions.get(sessionId);
        if (!sock) {
          const dbSess = await require('../models/Session').findOne({ sessionId }).select('status isActive').catch(() => null);
          if (!dbSess || !dbSess.isActive) {
            console.log(`[Baileys] Session ${sessionId} cannot reconnect (DB: inactive)`);
            return null;
          }
        }
        if (!sock || !sock.user) {
          if (!connectingSessions.has(sessionId)) {
            console.log(`[Baileys] Reconnecting session ${sessionId} (attempt ${attempt + 1}/${retries + 1})...`);
            connectSession(sessionId, globalIo).catch(e => console.error(`[Baileys] ${sessionId} reconnect error:`, e.message));
          }
        }
        return await waitForSocketReady(sessionId, RECONNECT_POLL_TIMEOUT);
      } catch (err) {
        console.error(`[Baileys] Reconnect error for ${sessionId} (attempt ${attempt + 1}):`, err.message);
        return null;
      }
    })();

    reconnectPromises.set(sessionId, promise);
    promise.finally(() => {
      if (reconnectPromises.get(sessionId) === promise) reconnectPromises.delete(sessionId);
    });

    const result = await promise;
    if (result) return result;

    if (attempt < retries) {
      console.log(`[Baileys] Retrying socket for ${sessionId} in 2s...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  throw new Error('WhatsApp connection is temporarily down. Auto-reconnecting... Please try again.');
};

// ==========================================
// ANTI-BAN IMPLEMENTATION IN MESSAGE SENDING
// ==========================================

const sendTextMessage = async (sessionId, to, text) => {
  const sock = await getOrReconnectSocket(sessionId);
  const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;
  
  // 1. Spintax parsing
  const finalizedText = replaceSpintax(text);

  // 2. Typing status simulation
  await emulateHumanActivity(sock, jid, 'text');

  const result = await sock.sendMessage(jid, { text: finalizedText });
  const msgId = result?.key?.id || '';
  if (!msgId) throw new Error('Message failed to send - no response from WhatsApp');
  const remoteJid = result?.key?.remoteJid || '';
  return { key: result?.key, id: msgId, remoteJid };
};

const sendMediaMessage = async (sessionId, to, url, type, caption = '') => {
  const sock = await getOrReconnectSocket(sessionId);
  const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;

  let mediaContent;
  if (url.startsWith('http')) {
    mediaContent = { url };
  } else {
    const filePath = path.resolve(__dirname, '..', url.replace(/^\//, ''));
    if (!fs.existsSync(filePath)) throw new Error(`Media file not found: ${filePath}`);
    mediaContent = fs.readFileSync(filePath);
  }

  let mediaMsg = {};
  switch (type) {
    case 'image': mediaMsg = { image: mediaContent, caption: replaceSpintax(caption) }; break;
    case 'video': mediaMsg = { video: mediaContent, caption: replaceSpintax(caption) }; break;
    case 'document': mediaMsg = { document: mediaContent, caption: replaceSpintax(caption) }; break;
    case 'audio': mediaMsg = { audio: mediaContent, mimetype: 'audio/mp4' }; break;
    default: throw new Error('Unsupported media type');
  }

  // 1. Status emulation (composing for files, recording for audios)
  await emulateHumanActivity(sock, jid, type);

  const result = await sock.sendMessage(jid, mediaMsg);
  const msgId = result?.key?.id || '';
  if (!msgId) throw new Error('Message failed to send - no response from WhatsApp');
  const remoteJid = result?.key?.remoteJid || '';
  return { key: result?.key, id: msgId, remoteJid };
};

const sendButtonMessage = async (sessionId, to, text, buttons) => {
  const sock = await getOrReconnectSocket(sessionId);
  const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;
  
  const buttonList = buttons.map((btn, idx) => ({
    buttonId: `btn_${idx}`,
    buttonText: { displayText: btn.title },
    type: btn.type === 'url' ? 1 : btn.type === 'call' ? 2 : 1
  }));

  // Emulation & Spintax
  const finalizedText = replaceSpintax(text);
  await emulateHumanActivity(sock, jid, 'text');

  const result = await sock.sendMessage(jid, { text: finalizedText, footer: 'RSendix.pro', buttons: buttonList, headerType: 1 });
  const msgId = result?.key?.id || '';
  if (!msgId) throw new Error('Message failed to send - no response from WhatsApp');
  return { key: result?.key, id: msgId };
};

const sendGroupMessage = async (sessionId, groupJid, text) => {
  const sock = await getOrReconnectSocket(sessionId);
  
  // Spintax & Typing delay in groups
  const finalizedText = replaceSpintax(text);
  await emulateHumanActivity(sock, groupJid, 'text');

  const result = await sock.sendMessage(groupJid, { text: finalizedText });
  const msgId = result?.key?.id || '';
  if (!msgId) throw new Error('Message failed to send - no response from WhatsApp');
  return { key: result?.key, id: msgId };
};

const getReadySocket = async (sessionId, timeoutMs = 15000) => {
  let sock = sessions.get(sessionId);
  if (sock && sock.user) return sock;

  const pendingPromise = reconnectPromises.get(sessionId);
  if (pendingPromise) {
    const result = await Promise.race([
      pendingPromise,
      new Promise(r => setTimeout(() => r(null), timeoutMs))
    ]);
    if (result && result.user) return result;
  }

  if (!connectingSessions.has(sessionId)) {
    connectSession(sessionId, globalIo).catch(e => console.error(`[Baileys] ${sessionId} getReadySocket error:`, e.message));
  }
  return await waitForSocketReady(sessionId, timeoutMs);
};

const getGroups = async (sessionId) => {
  const sock = await getReadySocket(sessionId);
  if (!sock || !sock.user) throw new Error('WhatsApp session not connected. Please scan QR code from WhatsApp Sessions page first.');
  const groups = await sock.groupFetchAllParticipating();
  return Object.entries(groups).map(([id, g]) => ({
    id, name: g.subject, memberCount: g.size, profilePic: g.profilePictureUrl || ''
  }));
};

const restoreSessions = async (io) => {
  try {
    const activeSessions = await Session.find({ isActive: true });
    console.log(`Found ${activeSessions.length} sessions to restore`);

    let restored = 0;
    for (const session of activeSessions) {
      const sessionDir = getSessionDir(session.sessionId);
      const credsPath = path.join(sessionDir, 'creds.json');
      if (fs.existsSync(credsPath)) {
        connectSession(session.sessionId, io).catch(err => console.error(`[Restore] Session ${session.sessionId}:`, err.message));
        restored++;
      } else {
        console.log(`[Baileys] Session ${session.sessionId} has no creds.json - requires QR re-scan`);
        await Session.findOneAndUpdate({ sessionId: session.sessionId }, { status: 'disconnected' });
      }
    }
    console.log(`Attempting restore for ${restored}/${activeSessions.length} sessions`);

    // Fire all connectSession calls concurrently (they're already fired above without await)
    // Now wait for all of them to connect (max 60 seconds total)
    const results = await Promise.allSettled(activeSessions.map(async (session) => {
      const sessionDir = getSessionDir(session.sessionId);
      if (!fs.existsSync(path.join(sessionDir, 'creds.json'))) return;
      for (let i = 0; i < 60; i++) {
        const sock = sessions.get(session.sessionId);
        if (sock && sock.user) break;
        await new Promise(r => setTimeout(r, 1000));
      }
      const sock = sessions.get(session.sessionId);
      if (sock && sock.user) {
        await Session.findOneAndUpdate({ sessionId: session.sessionId }, { status: 'connected' });
        console.log(`Session ${session.sessionId} restored successfully`);
      } else {
        console.log(`Session ${session.sessionId} could not be restored - may need QR re-scan`);
      }
    }));
  } catch (err) {
    console.error('Error restoring sessions:', err);
  }
};

const fetchProfilePic = async (sessionId, phone) => {
  try {
    const sock = sessions.get(sessionId);
    if (!sock || !sock.user) { console.log('[Profile] No socket or user for', sessionId); return ''; }
    const cleanPhone = phone.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;
    console.log('[Profile] Fetching pic for', jid);
    const url = await sock.profilePictureUrl(jid, 'image');
    console.log('[Profile] Result for', jid, '->', url ? 'URL found' : 'empty');
    return url || '';
  } catch (e) {
    console.log('[Profile] Error for', phone, ':', e.message?.slice(0, 100));
    return '';
  }
};

const fetchContactName = async (sessionId, phone) => {
  try {
    const sock = sessions.get(sessionId);
    if (!sock || !sock.user) return '';
    const cleanPhone = phone.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;

    try {
      const Chat = require('../models/Chat');
      const chat = await Chat.findOne({ waPhone: cleanPhone }).sort({ createdAt: -1 }).select('waName').lean();
      if (chat?.waName && chat.waName !== cleanPhone && !/^\d+$/.test(chat.waName)) return chat.waName;
    } catch (err) { console.error("WhatsApp Error:", err); }

    const cmap = sessionsContactMap.get(sessionId);
    if (cmap) {
      const contact = cmap.get(jid);
      if (contact) {
        const name = contact.notify || contact.name || contact.verifiedName || '';
        if (name && !/^\d+$/.test(name)) return name;
      }
    }

    try {
      const data = await sock.onWhatsApp(cleanPhone);
      if (data && data[0]?.jid && cmap) {
        const c = cmap.get(data[0].jid);
        if (c) {
          const name = c.notify || c.name || c.verifiedName || '';
          if (name && !/^\d+$/.test(name)) return name;
        }
      }
    } catch (err) { console.error("WhatsApp Error:", err); }

    return '';
  } catch {
    return '';
  }
};

const getAllContacts = async (sessionId) => {
  try {
    const sock = await getReadySocket(sessionId);
    if (!sock || !sock.user) throw new Error('WhatsApp session not connected.');

    let cmap = sessionsContactMap.get(sessionId);
    if (!cmap || cmap.size === 0) {
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 1000));
        cmap = sessionsContactMap.get(sessionId);
        if (cmap && cmap.size > 0) break;
      }
    }

    if (!cmap || cmap.size === 0) {
      const sockContacts = sock.contacts;
      if (sockContacts) {
        let entries = [];
        if (sockContacts instanceof Map) {
          for (const [jid, c] of sockContacts) {
            if (jid && !jid.includes('@g.us')) entries.push([jid, c]);
          }
        } else if (typeof sockContacts === 'object') {
          entries = Object.entries(sockContacts).filter(([jid]) => jid && !jid.includes('@g.us'));
        }
        if (entries.length > 0) cmap = new Map(entries);
      }
    }

    if (!cmap || cmap.size === 0) {
      // Try loading from persisted contacts file
      try {
        const contactFile = path.join(getSessionDir(sessionId), 'contacts.json');
        if (fs.existsSync(contactFile)) {
          const persisted = JSON.parse(fs.readFileSync(contactFile, 'utf8'));
          const loadedMap = new Map(Object.entries(persisted));
          if (loadedMap.size > 0) cmap = loadedMap;
        }
      } catch (e) { console.error('[Baileys] Contact file load error:', e.message); }
    }

    if (!cmap || cmap.size === 0) return [];
    return Array.from(cmap.values()).filter(c => c.id && typeof c.id === 'string' && !c.id.includes('@g.us')).map(c => ({
      jid: c.id,
      name: c.name || c.notify || c.verifiedName || '',
      phone: (c.id.split('@')[0]).slice(-10),
      imgUrl: c.imgUrl || ''
    }));
  } catch (err) {
    console.error(`[getAllContacts] Error for ${sessionId}:`, err.stack || err.message);
    throw err;
  }
};

const createPairingSession = async (sessionId, phoneNumber, io) => {
  try {
    // Clean up any existing socket first
    const existingSock = sessions.get(sessionId);
    if (existingSock) {
      try { existingSock.end(undefined); } catch (err) { console.error("WhatsApp Error:", err); }
      try { existingSock.ws?.close(); } catch (err) { console.error("WhatsApp Error:", err); }
    }
    cleanupSession(sessionId);
    const sessionDir = getSessionDir(sessionId);
    // Remove existing auth creds so pairing starts fresh
    const credsFile = path.join(sessionDir, 'creds.json');
    if (fs.existsSync(credsFile)) {
      try { fs.unlinkSync(credsFile); } catch (err) { console.error("WhatsApp Error:", err); }
    }
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const version = await getBaileysVersion();

    const sock = makeWASocket({
      auth: state,
      browser: Browsers.macOS('Chrome'),
      logger: pino({ level: 'warn' }),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      mobile: false,
      version,
      keepAliveIntervalMs: 10000,
      connectTimeoutMs: 120000,
      defaultQueryTimeoutMs: 180000,
      maxRetries: 2,
      emitOwnEvents: true,
      agent: baileysAgent
    });

    sessions.set(sessionId, sock);
    sessionsContactMap.set(sessionId, new Map());
    console.log(`[Baileys] Pairing socket created for ${sessionId}`);

    let pairingCode = '';
    // Wait for socket to be ready, then request pairing code
    try {
      // Try waitForSocketOpen with a timeout
      await Promise.race([
        sock.waitForSocketOpen(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Socket open timeout')), 30000))
      ]);
      // Short delay to ensure socket is stable
      await new Promise(r => setTimeout(r, 1000));
      // Check if already connected (means stored creds worked, no pairing needed)
      if (sock.user) {
        console.log(`[Baileys] Session ${sessionId} already authenticated, pairing code not needed`);
        return { pairingCode: 'ALREADY_CONNECTED', rawCode: '' };
      }
      pairingCode = await sock.requestPairingCode(phoneNumber);
      console.log(`[Baileys] Pairing code for ${sessionId}: ${pairingCode}`);
    } catch (err) {
      console.error(`[Baileys] Pairing code error for ${sessionId}:`, err.message);
      cleanupSession(sessionId);
      throw err;
    }

    // Set up event handlers (same as connectSession)
    sock.ev.on('contacts.upsert', (contacts) => {
      console.log(`[Baileys] Contacts upsert for ${sessionId}: ${contacts?.length} contacts`);
      const cmap = sessionsContactMap.get(sessionId);
      if (cmap) { for (const c of contacts) { if (c.id) cmap.set(c.id, c); } }
      try {
        const contactFile = path.join(getSessionDir(sessionId), 'contacts.json');
        const existing = fs.existsSync(contactFile) ? JSON.parse(fs.readFileSync(contactFile, 'utf8')) : {};
        for (const c of contacts) { if (c.id) existing[c.id] = c; }
        fs.writeFileSync(contactFile, JSON.stringify(existing));
      } catch (e) { console.error('[Baileys] Contact persist error:', e.message); }
    });

    sock.ev.on('contacts.update', (contacts) => {
      const cmap = sessionsContactMap.get(sessionId);
      if (cmap) { for (const c of contacts) { if (c.id) cmap.set(c.id, cmap.has(c.id) ? { ...cmap.get(c.id), ...c } : c); } }
      try {
        const contactFile = path.join(getSessionDir(sessionId), 'contacts.json');
        const existing = fs.existsSync(contactFile) ? JSON.parse(fs.readFileSync(contactFile, 'utf8')) : {};
        for (const c of contacts) { if (c.id) existing[c.id] = existing[c.id] ? { ...existing[c.id], ...c } : c; }
        fs.writeFileSync(contactFile, JSON.stringify(existing));
      } catch (e) { console.error('[Baileys] Pairing contacts.update persist error:', e.message); }
    });

    const sessionDoc = await Session.findOne({ sessionId });
    sock.ev.on('connection.update', async (update) => {
      try {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
          sessionDoc.status = 'connected';
          sessionDoc.phone = sock.user?.id?.split(':')[0] || phoneNumber;
          sessionDoc.lastSynced = new Date();
          await sessionDoc.save();
          if (io) io.emit('session:update', { sessionId, status: 'connected', phone: sessionDoc.phone });
          console.log(`[Baileys] Session ${sessionId} paired & connected!`);
        }
        if (connection === 'close') {
          const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.data?.reason || 428;
          if (reason === 401) { // loggedOut
            cleanupSession(sessionId);
            sessionDoc.status = 'disconnected';
            await sessionDoc.save();
            if (io) io.emit('session:update', { sessionId, status: 'disconnected' });
          }
        }
      } catch (e) { console.error('[Baileys] Pairing connection update error:', e.message); }
    });

    // Format pairing code with dashes (e.g., ABC-DEF-GH)
    const formattedCode = pairingCode.match(/.{1,3}/g)?.join('-') || pairingCode;
    return { pairingCode: formattedCode, rawCode: pairingCode };
  } catch (err) {
    console.error(`[Baileys] createPairingSession error for ${sessionId}:`, err.message);
    throw err;
  }
};

const getSavedVersion = () => savedVersion;

module.exports = {
  connectSession, disconnectSession, removeSession,
  sendTextMessage, sendMediaMessage, sendButtonMessage, sendGroupMessage, getGroups,
  getConnectionStatus, isSessionConnected, isSessionReady, restoreSessions, sessions,
  fetchProfilePic, fetchContactName, getReadySocket, getAllContacts, createPairingSession, waitForSessionQr,
  randomDelay, getSavedVersion
};
