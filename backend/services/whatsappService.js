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
const messageStore = new Map(); // sessionId -> Map<jid, Message[]>
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
  // Skip if WebSocket isn't fully open (presence will fail anyway)
  if (!sock || sock.ws?.readyState !== 1) {
    console.log(`[AntiBan] Skipping presence - WebSocket not OPEN (state=${sock?.ws?.readyState})`);
    return;
  }
  try {
    const presenceState = mediaType === 'audio' ? 'recording' : 'composing';
    console.log(`[AntiBan] Typing... for ${jid}`);
    await sock.sendPresenceUpdate(presenceState, jid);
    await new Promise(r => setTimeout(r, 3000));
    await sock.sendPresenceUpdate('paused', jid);
  } catch (err) {
    console.log(`[AntiBan] Presence update failed (${err.message}), skipping...`);
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

// WebSocket readyState constants (ws library)
const WS_OPEN = 1;

const isSocketTrulyReady = (sock) => {
  if (!sock) return false;
  if (!sock.user) return false;
  const wsState = sock.ws?.readyState;
  return wsState === WS_OPEN;
};

const isSessionConnected = (sessionId) => {
  const sock = sessions.get(sessionId);
  return isSocketTrulyReady(sock);
};

const isSessionReady = (sessionId) => {
  const sock = sessions.get(sessionId);
  return isSocketTrulyReady(sock);
};

const getConnectionStatus = async (sessionId) => {
  const sock = sessions.get(sessionId);
  if (isSocketTrulyReady(sock)) {
    return { status: 'connected', phone: sock.user.id.split(':')[0], wsState: 'OPEN' };
  }
  if (sock && sock.user) {
    const wsState = sock.ws?.readyState;
    const label = wsState === 0 ? 'CONNECTING' : wsState === 1 ? 'OPEN' : wsState === 2 ? 'CLOSING' : 'CLOSED';
    return { status: 'connecting', phone: sock.user.id?.split(':')[0] || '', wsState: label };
  }
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
  if (sock) return { status: 'connecting', phone: '', wsState: 'NO_USER' };
  return { status: 'disconnected', phone: '', errorMessage: '', errorDetails: null };
};

const cleanupSession = async (sessionId) => {
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
  messageStore.delete(sessionId);
  const oldSock = sessions.get(sessionId);
  if (oldSock) {
    try {
      const sessionDir = getSessionDir(sessionId);
      const credsPath = path.join(sessionDir, 'creds.json');
      if (oldSock.authState?.creds && fs.existsSync(path.dirname(credsPath))) {
        fs.writeFileSync(credsPath, JSON.stringify(oldSock.authState.creds, null, 2));
      }
    } catch (err) { console.error("[Baileys] Pre-cleanup credential save failed:", err.message); }
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

    await cleanupSession(sessionId);

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
      shouldSyncHistoryMessage: () => false,
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
    messageStore.set(sessionId, new Map());
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
              if (!s) return;
              const wsOk = s.ws?.readyState === 1;
              if (!wsOk || !s.user) {
                console.warn(`[Health] ${sessionId} UNHEALTHY: ws=${s.ws?.readyState}, user=${!!s.user}`);
              }
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
            const currentSock = sessions.get(sessionId);
            if (currentSock !== sock) {
              console.log(`[Baileys] Ignoring stale max-retries event for ${sessionId} - new socket exists`);
              return;
            }
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
            if (currentSock !== sock) {
              console.log(`[Baileys] Ignoring stale close event for ${sessionId} - new socket exists`);
              return;
            }
            sessions.delete(sessionId);
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

    sock.ev.on('messaging-history.set', async ({ contacts, chats, messages, isLatest }) => {
      if (contacts && contacts.length > 0) {
        console.log(`[Baileys] History set for ${sessionId}: ${contacts.length} contacts (isLatest:${isLatest})`);
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
        // Also auto-sync history contacts to MongoDB (skip LIDs)
        try {
          const Contact = require('../models/Contact');
          const sess = await Session.findOne({ sessionId });
          if (sess?.userId) {
            const bulkOps = [];
            for (const c of contacts) {
              if (!c.id || c.id.includes('@lid') || c.id.includes('@g.us')) continue;
              const raw = c.id.split('@')[0].replace(/[^0-9]/g, '');
              if (raw.length > 13 || raw.length < 10) continue; // skip LIDs
              const phone = raw.slice(-10);
              if (!phone) continue;
              bulkOps.push({
                updateOne: {
                  filter: { userId: sess.userId, phone },
                  upsert: true,
                  update: { $set: { name: c.name || c.notify || c.verifiedName || '', phone, source: 'baileys_history', sessionId } }
                }
              });
            }
            if (bulkOps.length > 0) {
              await Contact.bulkWrite(bulkOps);
              console.log(`[Baileys] Synced ${bulkOps.length} history contacts to MongoDB for ${sessionId}`);
            }
          }
        } catch (e) { console.error('[Baileys] History contacts MongoDB sync error:', e.message); }
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
      if (msg?.key?.remoteJid) {
        try {
          const jid = msg.key.remoteJid;
          if (!messageStore.has(sessionId)) messageStore.set(sessionId, new Map());
          const chatStore = messageStore.get(sessionId);
          if (!chatStore.has(jid)) chatStore.set(jid, []);
          const arr = chatStore.get(jid);
          arr.push({
            msgId: msg.key.id || '',
            key: msg.key,
            message: msg.message,
            messageTimestamp: msg.messageTimestamp,
            pushName: msg.pushName
          });
          if (arr.length > 1000) arr.splice(0, arr.length - 1000);
        } catch (e) {
          console.error(`[Baileys] Message store error for ${sessionId}:`, e.message);
        }
      }
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
      const eventIo = io || globalIo;
      if (eventIo && msg.key.remoteJid && !msg.key.remoteJid.endsWith('@g.us') && !msg.key.remoteJid.endsWith('@broadcast')) {
        eventIo.to(`session_${sessionId}`).emit('message:incoming', {
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
            if (waStatus === 4) dbStatus = 'read';
            else if (waStatus === 3) dbStatus = 'delivered';
            else if (waStatus === 5) dbStatus = 'played';
            else if (waStatus === 0) dbStatus = 'failed';
            const Message = require('../models/Message');
            const updateFields = { status: dbStatus };
            if (dbStatus === 'delivered') updateFields.deliveredAt = new Date();
            if (dbStatus === 'read') updateFields.readAt = new Date();
            const updated = await Message.findOneAndUpdate(
              { waMessageId: key.id },
              updateFields,
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
  await cleanupSession(sessionId);
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
    if (isSocketTrulyReady(sock)) return sock;
    if (sock && sock.ws) {
      const state = sock.ws.readyState;
      if (state !== 0) { // 0 = CONNECTING
        console.log(`[Baileys] ${sessionId} ws.readyState=${state} (1=OPEN), waiting...`);
      }
    }
    await new Promise(r => setTimeout(r, RECONNECT_POLL_INTERVAL));
  }
  const sock = sessions.get(sessionId);
  if (sock) {
    console.warn(`[Baileys] ${sessionId} waitForSocketReady timeout. ws.readyState=${sock.ws?.readyState}, user=${!!sock.user}`);
  }
  return null;
};

const getOrReconnectSocket = async (sessionId, retries = 2) => {
  let sock = sessions.get(sessionId);
  // Check actual WebSocket state, not just sock.user
  if (isSocketTrulyReady(sock)) {
    console.log(`[Baileys] ${sessionId} socket truly ready (WS OPEN, user: ${sock.user?.id?.split(':')[0]})`);
    return sock;
  }

  if (sock && sock.user) {
    console.warn(`[Baileys] ${sessionId} sock.user exists but WS not open (state=${sock.ws?.readyState}). Forcing reconnection...`);
  }

  const pendingPromise = reconnectPromises.get(sessionId);
  if (pendingPromise) {
    const result = await pendingPromise;
    if (result && isSocketTrulyReady(result)) return result;
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
        if (!sock || !isSocketTrulyReady(sock)) {
          if (!connectingSessions.has(sessionId)) {
            console.log(`[Baileys] Reconnecting session ${sessionId} (attempt ${attempt + 1}/${retries + 1})...`);
            connectSession(sessionId, globalIo).catch(e => console.error(`[Baileys] ${sessionId} reconnect error:`, e.message));
          }
        }
        const readySock = await waitForSocketReady(sessionId, RECONNECT_POLL_TIMEOUT);
        if (readySock) {
          console.log(`[Baileys] ${sessionId} socket ready after reconnect attempt ${attempt + 1}`);
        }
        return readySock;
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
    if (result && isSocketTrulyReady(result)) return result;

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

// Rate-limit backoff helper
const WAIT_RATE_LIMITED = 60000;

// Resolve JID: ALWAYS construct @s.whatsapp.net from clean digits.
// CRITICAL: Never trust onWhatsApp() returned JID — Baileys v6.7.9+ can return @lid JIDs
// which are NOT valid for direct messaging. Use onWhatsApp() ONLY for existence check.
const resolveJid = async (sock, to) => {
  // If already a full JID, return as-is
  if (to.includes('@s.whatsapp.net')) {
    const num = to.split('@')[0].replace(/[^0-9]/g, '');
    if (num.length < 10) return { jid: to, verified: false, notOnWA: true };
    return { jid: to, verified: true };
  }

  // CRITICAL FIX: Always construct JID from clean digits, never from onWhatsApp() response
  const clean = to.replace(/[^0-9]/g, '');
  if (clean.length < 10 || clean.length > 15) {
    console.error(`[resolveJid] Invalid phone number length (${clean.length}): ${clean}`);
    return { jid: `${clean}@s.whatsapp.net`, verified: false, notOnWA: true };
  }

  const jid = `${clean}@s.whatsapp.net`;

  // Use onWhatsApp ONLY for existence verification, NOT for JID construction
  try {
    const result = await sock.onWhatsApp(clean);
    if (Array.isArray(result) && result.length > 0) {
      const entry = result[0];
      console.log(`[resolveJid] onWhatsApp(${clean}): exists=${entry.exists}, returnedJid=${entry.jid || 'none'}`);

      if (entry.exists === false) {
        console.warn(`[resolveJid] ${clean} is NOT registered on WhatsApp`);
        return { jid, verified: false, notOnWA: true };
      }
      // ALWAYS use our constructed JID, ignore entry.jid (could be @lid)
      return { jid, verified: true };
    }
    // Empty response — number might still exist, try sending anyway
    console.warn(`[resolveJid] onWhatsApp returned empty for ${clean}, will attempt send with ${jid}`);
    return { jid, verified: false };
  } catch (err) {
    console.warn(`[resolveJid] onWhatsApp failed for ${clean}: ${err.message}. Attempting with ${jid}`);
    // Even if onWhatsApp fails, the JID format is correct — let sendMessage try
    return { jid, verified: false };
  }
};

// Decode Baileys/WhatsApp error to a readable code
const getBaileysErrorCode = (err) => {
  if (!err) return null;
  // Baileys HTTP errors have statusCode in output
  const statusCode = err.output?.statusCode || err.data?.reason || err.statusCode;
  if (statusCode) return statusCode;
  // Check message for known codes
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('rate') || msg.includes('too many') || msg.includes('429')) return 429;
  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('logged out')) return 401;
  if (msg.includes('403') || msg.includes('forbidden') || msg.includes('blocked')) return 403;
  if (msg.includes('404') || msg.includes('not found') || msg.includes('not on whatsapp')) return 404;
  if (msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('econnreset')) return 500;
  return null;
};

// Validate socket is truly ready at SEND time (not just connection time)
const validateSocketForSend = (sock, sessionId, context = 'send') => {
  if (!sock) {
    throw new Error(`[${context}] WhatsApp socket is null for session ${sessionId}`);
  }
  if (!sock.user) {
    throw new Error(`[${context}] WhatsApp socket has no user (not authenticated). Session: ${sessionId}`);
  }
  const wsState = sock.ws?.readyState;
  if (wsState !== WS_OPEN) {
    const stateLabel = wsState === 0 ? 'CONNECTING' : wsState === 2 ? 'CLOSING' : 'CLOSED';
    throw new Error(`[${context}] WhatsApp WebSocket is ${stateLabel} (readyState=${wsState}). Session: ${sessionId}. Wait and retry.`);
  }
  return true;
};

const sendTextMessage = async (sessionId, to, text) => {
  const cleanTo = to.replace(/[^0-9]/g, '');
  const lastTen = cleanTo.slice(-10);
  console.log(`[sendTextMessage] START sessionId=${sessionId}, to=...${lastTen}`);

  const sock = await getOrReconnectSocket(sessionId);

  // CRITICAL: Validate socket at send time, not just at connection time
  validateSocketForSend(sock, sessionId, 'sendTextMessage');
  console.log(`[sendTextMessage] Socket validated: ws.readyState=${sock.ws?.readyState}, user=${sock.user?.id?.split(':')[0]}`);

  // 1. Resolve JID with onWhatsApp verification
  const { jid, verified, notOnWA } = await resolveJid(sock, to);
  if (notOnWA) {
    throw new Error(`Number ...${lastTen} is NOT registered on WhatsApp`);
  }
  console.log(`[sendTextMessage] JID=${jid}, verified=${verified}`);

  // 2. Spintax parsing
  const finalizedText = replaceSpintax(text);
  console.log(`[sendTextMessage] Sending to ${jid}: "${finalizedText.slice(0, 50)}${finalizedText.length > 50 ? '...' : ''}"`);

  // 3. Typing status simulation (skip if short message to reduce latency)
  if (finalizedText.length > 20) {
    await emulateHumanActivity(sock, jid, 'text');
  }

  // 4. Send with retry for transient failures
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    // Re-validate WS state before each attempt (connection can drop between retries)
    try {
      validateSocketForSend(sock, sessionId, 'sendTextMessage-retry');
    } catch (valErr) {
      console.error(`[sendTextMessage] Socket invalid before attempt ${attempt}: ${valErr.message}`);
      // Try to get a fresh socket
      const freshSock = await getOrReconnectSocket(sessionId);
      validateSocketForSend(freshSock, sessionId, 'sendTextMessage-fresh');
    }

    try {
      const result = await sock.sendMessage(jid, { text: finalizedText });
      const msgId = result?.key?.id || '';
      if (!msgId) throw new Error('Message failed to send - no response from WhatsApp');
      const remoteJid = result?.key?.remoteJid || '';
      console.log(`[sendTextMessage] SUCCESS msgId=${msgId}, remoteJid=${remoteJid}`);
      return { key: result?.key, id: msgId, remoteJid };
    } catch (err) {
      lastError = err;
      const errCode = getBaileysErrorCode(err);
      console.error(`[sendTextMessage] FAILED attempt ${attempt}/2, code=${errCode}: ${err.message}`);

      if (errCode === 401) {
        console.error(`[sendTextMessage] FATAL: Session ${sessionId} logged out (401). Clearing connection.`);
        sessions.delete(sessionId);
        throw new Error('WhatsApp session logged out (401). Please re-scan QR code.');
      }
      if (errCode === 403) {
        throw new Error(`Message blocked by WhatsApp (403). Your number may be restricted or the recipient has privacy settings. Number: ...${lastTen}`);
      }
      if (errCode === 404) {
        throw new Error(`Recipient ...${lastTen} not found on WhatsApp (404).`);
      }
      if (errCode === 429) {
        if (attempt < 2) {
          const waitSec = WAIT_RATE_LIMITED / 1000;
          console.log(`[sendTextMessage] Rate limited (429). Waiting ${waitSec}s before retry...`);
          await new Promise(r => setTimeout(r, WAIT_RATE_LIMITED));
          continue;
        }
        throw new Error('WhatsApp rate limit exceeded (429). Please wait before sending more messages.');
      }
      if (errCode === 500 && attempt < 2) {
        console.log(`[sendTextMessage] Transient server error (500). Retrying in 3s...`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      if (attempt < 2) {
        console.log(`[sendTextMessage] Retrying in 2s...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
  throw lastError || new Error('Message failed after 2 retries');
};

const sendMediaMessage = async (sessionId, to, url, type, caption = '') => {
  const cleanTo = to.replace(/[^0-9]/g, '');
  const lastTen = cleanTo.slice(-10);
  console.log(`[sendMediaMessage] START sessionId=${sessionId}, type=${type}, to=...${lastTen}`);

  const sock = await getOrReconnectSocket(sessionId);
  validateSocketForSend(sock, sessionId, 'sendMediaMessage');

  // 1. Resolve JID with onWhatsApp
  const { jid, verified, notOnWA } = await resolveJid(sock, to);
  if (notOnWA) {
    throw new Error(`Number ...${lastTen} is NOT registered on WhatsApp`);
  }
  console.log(`[sendMediaMessage] JID=${jid}, verified=${verified}`);

  // 2. Prepare media content
  let mediaContent;
  let fileName = 'file';
  if (url.startsWith('http')) {
    mediaContent = { url };
    try {
      const urlPath = new URL(url).pathname;
      fileName = path.basename(urlPath) || 'file';
    } catch (e) { /* keep default */ }
  } else {
    const filePath = path.resolve(__dirname, '..', url.replace(/^\//, ''));
    if (!fs.existsSync(filePath)) throw new Error(`Media file not found: ${filePath}`);
    mediaContent = fs.readFileSync(filePath);
    fileName = path.basename(filePath);
  }

  const ext = path.extname(fileName).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4', '.avi': 'video/x-msvideo', '.mov': 'video/quicktime',
    '.pdf': 'application/pdf', '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain', '.csv': 'text/csv',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
  };
  const mimetype = mimeMap[ext] || 'application/octet-stream';

  let mediaMsg = {};
  switch (type) {
    case 'image':
      mediaMsg = { image: mediaContent, caption: replaceSpintax(caption), mimetype: mimetype };
      break;
    case 'video':
      mediaMsg = { video: mediaContent, caption: replaceSpintax(caption), mimetype: mimetype };
      break;
    case 'document':
      mediaMsg = { document: mediaContent, caption: replaceSpintax(caption), fileName, mimetype };
      break;
    case 'audio':
      mediaMsg = { audio: mediaContent, mimetype: mimetype };
      break;
    default: throw new Error('Unsupported media type');
  }

  console.log(`[sendMediaMessage] Sending ${type} to ${jid}`);

  // 3. Status emulation (composing for files, recording for audios)
  await emulateHumanActivity(sock, jid, type);

  // 4. Send with retry
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      validateSocketForSend(sock, sessionId, 'sendMediaMessage-retry');
      const result = await sock.sendMessage(jid, mediaMsg);
      const msgId = result?.key?.id || '';
      if (!msgId) throw new Error('Message failed to send - no response from WhatsApp');
      const remoteJid = result?.key?.remoteJid || '';
      console.log(`[sendMediaMessage] SUCCESS msgId=${msgId}, remoteJid=${remoteJid}`);
      return { key: result?.key, id: msgId, remoteJid };
    } catch (err) {
      lastError = err;
      const errCode = getBaileysErrorCode(err);
      console.error(`[sendMediaMessage] FAILED attempt ${attempt}/2, code=${errCode}: ${err.message}`);

      if (errCode === 401) {
        sessions.delete(sessionId);
        throw new Error('WhatsApp session logged out (401). Please re-scan QR code.');
      }
      if (errCode === 403) {
        throw new Error('Message blocked by WhatsApp (403). Your number may be restricted.');
      }
      if (errCode === 404) {
        throw new Error(`Recipient ...${lastTen} not found on WhatsApp (404).`);
      }
      if (errCode === 429) {
        if (attempt < 2) {
          console.log(`[sendMediaMessage] Rate limited (429). Waiting ${WAIT_RATE_LIMITED / 1000}s...`);
          await new Promise(r => setTimeout(r, WAIT_RATE_LIMITED));
          continue;
        }
        throw new Error('WhatsApp rate limit exceeded (429). Please wait before sending more messages.');
      }
      if (errCode === 500 && attempt < 2) {
        console.log(`[sendMediaMessage] Transient error (500). Retrying in 3s...`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      if (attempt < 2) {
        console.log(`[sendMediaMessage] Retrying in 2s...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
  throw lastError || new Error('Media message failed after retries');
};

const sendButtonMessage = async (sessionId, to, text, buttons) => {
  const cleanTo = to.replace(/[^0-9]/g, '');
  const lastTen = cleanTo.slice(-10);
  console.log(`[sendButtonMessage] START sessionId=${sessionId}, to=...${lastTen}, buttons=${buttons?.length}`);
  const sock = await getOrReconnectSocket(sessionId);
  validateSocketForSend(sock, sessionId, 'sendButtonMessage');
  const { jid, notOnWA } = await resolveJid(sock, to);
  if (notOnWA) {
    throw new Error(`Number ...${lastTen} is NOT registered on WhatsApp`);
  }
  
  const buttonList = buttons.map((btn, idx) => ({
    buttonId: `btn_${idx}`,
    buttonText: { displayText: btn.title },
    type: btn.type === 'url' ? 1 : btn.type === 'call' ? 2 : 1
  }));

  const finalizedText = replaceSpintax(text);
  await emulateHumanActivity(sock, jid, 'text');

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      validateSocketForSend(sock, sessionId, 'sendButtonMessage-retry');
      const result = await sock.sendMessage(jid, { text: finalizedText, footer: 'RSendix.pro', buttons: buttonList, headerType: 1 });
      const msgId = result?.key?.id || '';
      if (!msgId) throw new Error('Message failed to send - no response from WhatsApp');
      console.log(`[sendButtonMessage] SUCCESS msgId=${msgId}`);
      return { key: result?.key, id: msgId };
    } catch (err) {
      lastError = err;
      const errCode = getBaileysErrorCode(err);
      console.error(`[sendButtonMessage] FAILED attempt ${attempt}/2, code=${errCode}: ${err.message}`);
      if (errCode === 401) throw new Error('WhatsApp session logged out. Please re-scan QR code.');
      if (errCode === 403) throw new Error('Message blocked by WhatsApp (403).');
      if (errCode === 429 && attempt < 2) {
        await new Promise(r => setTimeout(r, WAIT_RATE_LIMITED));
        continue;
      }
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw lastError || new Error('Button message failed after retries');
};

const sendGroupMessage = async (sessionId, groupJid, text) => {
  console.log(`[sendGroupMessage] START sessionId=${sessionId}, groupJid=${groupJid}`);
  const sock = await getOrReconnectSocket(sessionId);
  validateSocketForSend(sock, sessionId, 'sendGroupMessage');
  
  const finalizedText = replaceSpintax(text);
  await emulateHumanActivity(sock, groupJid, 'text');

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      validateSocketForSend(sock, sessionId, 'sendGroupMessage-retry');
      const result = await sock.sendMessage(groupJid, { text: finalizedText });
      const msgId = result?.key?.id || '';
      if (!msgId) throw new Error('Message failed to send - no response from WhatsApp');
      console.log(`[sendGroupMessage] SUCCESS msgId=${msgId}`);
      return { key: result?.key, id: msgId };
    } catch (err) {
      lastError = err;
      const errCode = getBaileysErrorCode(err);
      console.error(`[sendGroupMessage] FAILED attempt ${attempt}/2, code=${errCode}: ${err.message}`);
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw lastError || new Error('Group message failed after retries');
};

const getReadySocket = async (sessionId, timeoutMs = 60000) => {
  let sock = sessions.get(sessionId);
  if (isSocketTrulyReady(sock)) return sock;

  if (sock && sock.user) {
    console.warn(`[Baileys] ${sessionId} getReadySocket: user exists but WS not open (state=${sock.ws?.readyState})`);
  }

  const pendingPromise = reconnectPromises.get(sessionId);
  if (pendingPromise) {
    const result = await Promise.race([
      pendingPromise,
      new Promise(r => setTimeout(() => r(null), timeoutMs))
    ]);
    if (result && isSocketTrulyReady(result)) return result;
  }

  if (!connectingSessions.has(sessionId)) {
    connectSession(sessionId, globalIo).catch(e => console.error(`[Baileys] ${sessionId} getReadySocket error:`, e.message));
  }
  return await waitForSocketReady(sessionId, timeoutMs);
};

const getGroups = async (sessionId) => {
  const sock = await getReadySocket(sessionId);
  if (!isSocketTrulyReady(sock)) {
    throw new Error('WhatsApp session not connected (WebSocket not OPEN). Please scan QR code from WhatsApp Sessions page first.');
  }
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

    // Wait with staggered delays to avoid overwhelming server
    await new Promise(r => setTimeout(r, 5000));

    for (const session of activeSessions) {
      const sessionDir = getSessionDir(session.sessionId);
      if (!fs.existsSync(path.join(sessionDir, 'creds.json'))) continue;
      for (let i = 0; i < 30; i++) {
        const sock = sessions.get(session.sessionId);
        if (isSocketTrulyReady(sock)) break;
        await new Promise(r => setTimeout(r, 1000));
      }
      const sock = sessions.get(session.sessionId);
      if (isSocketTrulyReady(sock)) {
        await Session.findOneAndUpdate({ sessionId: session.sessionId }, { status: 'connected' });
        console.log(`Session ${session.sessionId} restored successfully (WS OPEN)`);
      } else {
        const wsState = sock?.ws?.readyState;
        console.warn(`Session ${session.sessionId} restore: user=${!!sock?.user}, ws.readyState=${wsState} - may need QR re-scan`);
      }
    }
  } catch (err) {
    console.error('Error restoring sessions:', err);
  }
};

const fetchProfilePic = async (sessionId, phone) => {
  try {
    const sock = sessions.get(sessionId);
    if (!isSocketTrulyReady(sock)) {
      console.log(`[Profile] Socket not ready for ${sessionId} (ws=${sock?.ws?.readyState}, user=${!!sock?.user})`);
      return '';
    }
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
    if (!isSocketTrulyReady(sock)) throw new Error('WhatsApp session not connected (WebSocket not OPEN).');

    const combined = new Map();
    const isRealPhone = (jid) => {
      const n = (jid || '').split('@')[0].replace(/[^0-9]/g, '');
      return n.length >= 10 && n.length <= 13;
    };

    // Source A: Event-driven sessionsContactMap (populated by messaging-history.set — FULL address book)
    const eventMap = sessionsContactMap.get(sessionId);
    if (eventMap && eventMap.size > 0) {
      let added = 0;
      for (const [jid, c] of eventMap) {
        if (jid && !jid.includes('@g.us') && isRealPhone(jid) && !combined.has(jid)) {
          combined.set(jid, c);
          added++;
        }
      }
      console.log(`[getAllContacts] ${sessionId}: ${added} contacts from event map`);
    }

    // Source B: Direct read from sock.contacts (auth state — partial but may have richer names)
    if (sock?.contacts) {
      let added = 0;
      if (sock.contacts instanceof Map) {
        for (const [jid, c] of sock.contacts) {
          if (jid && !jid.includes('@g.us') && isRealPhone(jid)) {
            if (combined.has(jid)) {
              const ex = combined.get(jid);
              if (c.name && !ex.name) ex.name = c.name;
              if (c.notify && !ex.notify) ex.notify = c.notify;
            } else {
              combined.set(jid, c);
              added++;
            }
          }
        }
      } else if (typeof sock.contacts === 'object') {
        for (const [jid, c] of Object.entries(sock.contacts)) {
          if (jid && !jid.includes('@g.us') && isRealPhone(jid)) {
            if (combined.has(jid)) {
              const ex = combined.get(jid);
              if (c.name && !ex.name) ex.name = c.name;
              if (c.notify && !ex.notify) ex.notify = c.notify;
            } else {
              combined.set(jid, c);
              added++;
            }
          }
        }
      }
      console.log(`[getAllContacts] ${sessionId}: ${added} extra from sock.contacts`);
    }

    // Source C: Persisted contacts.json
    try {
      const contactFile = path.join(getSessionDir(sessionId), 'contacts.json');
      if (fs.existsSync(contactFile)) {
        const persisted = JSON.parse(fs.readFileSync(contactFile, 'utf8'));
        let added = 0;
        for (const [jid, c] of Object.entries(persisted)) {
          if (jid && !jid.includes('@g.us') && isRealPhone(jid) && !combined.has(jid)) {
            combined.set(jid, c);
            added++;
          }
        }
        if (added > 0) console.log(`[getAllContacts] ${sessionId}: ${added} extra from disk`);
      }
    } catch (e) { console.error('[Baileys] Contact file load error:', e.message); }

    if (combined.size === 0) return [];
    return Array.from(combined.values()).filter(c => c.id && typeof c.id === 'string' && !c.id.includes('@g.us') && isRealPhone(c.id)).map(c => ({
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

/**
 * Wait for Baileys contacts to sync AND also check sock.contacts directly.
 * Polls both sessionsContactMap and sock.contacts until stable or timeout.
 */
const waitForContactSync = async (sessionId, minContacts = 5, timeoutMs = 30000) => {
  const start = Date.now();
  let lastEventCount = 0;
  let lastDirectCount = 0;
  let stableMs = 0;

  while (Date.now() - start < timeoutMs) {
    const cmap = sessionsContactMap.get(sessionId);
    const eventCount = cmap?.size || 0;
    const sock = sessions.get(sessionId);
    let directCount = 0;
    if (sock?.contacts) {
      if (sock.contacts instanceof Map) directCount = sock.contacts.size;
      else if (typeof sock.contacts === 'object') directCount = Object.keys(sock.contacts).length;
    }

    // Use whichever is larger
    const effectiveCount = Math.max(eventCount, directCount);
    if (effectiveCount >= minContacts) {
      // Check if count is stable (no new contacts for 5s)
      if (effectiveCount === Math.max(lastEventCount, lastDirectCount)) {
        stableMs += 1500;
        if (stableMs >= 5000) {
          console.log(`[waitForContactSync] ${sessionId}: stable at ${effectiveCount} (event:${eventCount}, direct:${directCount}) contacts in ${Date.now() - start}ms`);
          return effectiveCount;
        }
      } else {
        stableMs = 0;
      }
    }

    if (eventCount !== lastEventCount || directCount !== lastDirectCount) {
      console.log(`[waitForContactSync] ${sessionId}: event:${eventCount}, direct:${directCount}`);
      lastEventCount = eventCount;
      lastDirectCount = directCount;
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  const cmap = sessionsContactMap.get(sessionId);
  const sock = sessions.get(sessionId);
  const finalEvent = cmap?.size || 0;
  const finalDirect = sock?.contacts ? (sock.contacts instanceof Map ? sock.contacts.size : Object.keys(sock.contacts).length) : 0;
  console.log(`[waitForContactSync] ${sessionId}: timeout, final event:${finalEvent}, direct:${finalDirect}`);
  return Math.max(finalEvent, finalDirect);
};

const createPairingSession = async (sessionId, phoneNumber, io) => {
  try {
    // Clean up any existing socket first
    const existingSock = sessions.get(sessionId);
    if (existingSock) {
      try { existingSock.end(undefined); } catch (err) { console.error("WhatsApp Error:", err); }
      try { existingSock.ws?.close(); } catch (err) { console.error("WhatsApp Error:", err); }
    }
    await cleanupSession(sessionId);
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
      browser: Browsers.ubuntu('Chrome'),
      logger: pino({ level: 'warn' }),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
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
      await cleanupSession(sessionId);
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
            await cleanupSession(sessionId);
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

const loadMessages = async (sessionId, jid, limit = 50) => {
  const store = messageStore.get(sessionId);
  if (!store) return [];
  const msgs = store.get(jid);
  if (!msgs) return [];
  return msgs.slice(-Math.min(limit, 200)).map(m => ({
    key: m.key,
    message: m.message,
    messageTimestamp: m.messageTimestamp,
    pushName: m.pushName
  }));
};

const getSavedVersion = () => savedVersion;

module.exports = {
  connectSession, disconnectSession, removeSession,
  sendTextMessage, sendMediaMessage, sendButtonMessage, sendGroupMessage, getGroups,
  getConnectionStatus, isSessionConnected, isSessionReady, restoreSessions, sessions, sessionsContactMap,
  fetchProfilePic, fetchContactName, getReadySocket, getAllContacts, createPairingSession, waitForSessionQr,
  randomDelay, getSavedVersion, waitForContactSync, loadMessages
};
