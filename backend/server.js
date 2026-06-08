require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const dns = require('dns');
const https = require('https');
const WebSocket = require('ws');

const jwt = require('jsonwebtoken');
const errorHandler = require('./middleware/errorHandler');
const schedulerService = require('./services/schedulerService');
const { seedAll } = require('./utils/seeder');
const whatsappService = require('./services/whatsappService');
const { startCleanupSchedule } = require('./services/cleanupScheduleService');
const aiService = require('./services/aiService');
const Session = require('./models/Session');
const { setIoInstance } = require('./socket');

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  console.error(err.stack);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  console.error(err.stack);
  setTimeout(() => process.exit(1), 1000);
});

const app = express();
const server = http.createServer(app);
app.set('trust proxy', 1);

const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true;
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.set('io', io);
setIoInstance(io);

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => (
    req.path === '/api/health' ||
    req.path === '/api/auth/login' ||
    req.path === '/api/auth/register'
  ),
  message: { success: false, message: 'Too many requests, please try again later' }
});

app.use(require('compression')());
app.use(require('helmet')({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const sessionsDir = path.join(__dirname, process.env.SESSIONS_DIR || 'sessions');
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

const dbState = {
  status: 'starting',
  connected: false,
  attempts: 0,
  lastConnectedAt: null,
  lastError: null
};

const getMongoStatus = () => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || 'unknown';
};

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'RSendix.pro API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      status: getMongoStatus(),
      connected: mongoose.connection.readyState === 1,
      lastConnectedAt: dbState.lastConnectedAt,
      lastError: dbState.lastError
    }
  });
});

app.get('/api/debug/connectivity', async (req, res) => {
  const results = [];
  const check = (name) => new Promise((resolve) => {
    const start = Date.now();
    dns.resolve(name, (dnsErr) => {
      if (dnsErr) { results.push({ target: name, dns: 'FAIL', dnsError: dnsErr.code, time: Date.now() - start }); resolve(); return; }
      const req = https.get(`https://${name}/`, { timeout: 10000 }, (r) => {
        results.push({ target: name, dns: 'OK', https: r.statusCode, time: Date.now() - start });
        r.destroy();
        resolve();
      });
      req.on('error', (e) => { results.push({ target: name, dns: 'OK', https: 'FAIL', httpsError: e.message, time: Date.now() - start }); resolve(); });
      req.on('timeout', () => { req.destroy(); results.push({ target: name, dns: 'OK', https: 'TIMEOUT', time: Date.now() - start }); resolve(); });
    });
  });
  // Direct WebSocket test to wss://web.whatsapp.com/ws/chat
  const checkWs = () => new Promise((resolve) => {
    const start = Date.now();
    try {
      const ws = new WebSocket('wss://web.whatsapp.com/ws/chat', {
        origin: 'https://web.whatsapp.com',
        handshakeTimeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
      });
      ws.on('open', () => {
        results.push({ target: 'wss://web.whatsapp.com/ws/chat', type: 'WebSocket', status: 'OPEN', time: Date.now() - start });
        ws.close();
        resolve();
      });
      ws.on('error', (e) => {
        results.push({ target: 'wss://web.whatsapp.com/ws/chat', type: 'WebSocket', status: 'FAIL', error: e.message, time: Date.now() - start });
        resolve();
      });
      ws.on('unexpected-response', (req2, res2) => {
        results.push({ target: 'wss://web.whatsapp.com/ws/chat', type: 'WebSocket', status: 'UNEXPECTED_RESPONSE', httpStatus: res2.statusCode, time: Date.now() - start });
        resolve();
      });
      setTimeout(() => {
        if (ws.readyState !== ws.OPEN && ws.readyState !== ws.CLOSED) {
          ws.close();
          results.push({ target: 'wss://web.whatsapp.com/ws/chat', type: 'WebSocket', status: 'TIMEOUT', time: Date.now() - start });
          resolve();
        }
      }, 12000);
    } catch (e) {
      results.push({ target: 'wss://web.whatsapp.com/ws/chat', type: 'WebSocket', status: 'EXCEPTION', error: e.message, time: Date.now() - start });
      resolve();
    }
  });
  await Promise.all([
    check('web.whatsapp.com'),
    check('raw.githubusercontent.com'),
    check('ws.whatsapp.net'),
    check('google.com'),
    checkWs()
  ]);
  res.json({ success: true, timestamp: new Date().toISOString(), results });
});

app.use('/api/', limiter);

app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).json({
    success: false,
    message: 'Database is starting. Please retry in a moment.',
    database: { status: getMongoStatus() }
  });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/sessions', require('./routes/sessions'));
app.get('/api/debug/session/:id', async (req, res) => {
  try {
    const { auth } = require('./middleware/auth');
    await auth(req, res, async () => {
      const { tenantMiddleware } = require('./middleware/tenant');
      await tenantMiddleware(req, res, async () => {
        const sessionController = require('./controllers/sessionController');
        await sessionController.getSessionDebug(req, res);
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/api', require('./routes/api'));
app.use('/api/upload', require('./routes/uploads'));
app.use('/api/support', require('./routes/support'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/compliance', require('./routes/compliance'));
app.use('/api/automation', require('./routes/automation'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/team', require('./routes/team'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/integration', require('./routes/integration'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/scheduler', require('./routes/scheduler'));
app.use('/api/sms-fallback', require('./routes/smsFallback'));
app.use('/api/ecommerce', require('./routes/ecommerce'));
app.use('/api/intent', require('./routes/intent'));
app.use('/api/data-capture', require('./routes/dataCapture'));
app.use('/api/auto-reply', require('./routes/autoReply'));
app.use('/api/cleanup', require('./routes/cleanup'));
app.use('/api/import-contacts', require('./routes/importContacts'));
app.use('/api/preview', require('./routes/preview'));
app.use('/api/follow-up', require('./routes/followUp'));
app.use('/api/deals', require('./routes/deals'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/email', require('./routes/email'));
app.use('/api/products', require('./routes/products'));
app.use('/api/quotes', require('./routes/quotes'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/webforms', require('./routes/webforms'));
app.use('/f', require('./routes/webforms').publicRouter);
app.use('/api/lead-scores', require('./routes/leadScores'));
app.use('/api/email-campaigns', require('./routes/emailCampaigns'));
app.use('/t', require('./routes/emailCampaigns').publicRouter);
app.use('/api/sms-campaigns', require('./routes/smsCampaigns'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/dashboard-configs', require('./routes/dashboardConfigs'));
app.use('/api/email-templates', require('./routes/emailTemplates'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/surveys', require('./routes/surveys'));
app.use('/api/webhooks/api', require('./routes/webhooks'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/email-sync', require('./routes/emailSync'));
app.use('/s', require('./routes/surveys').publicRouter);

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

// Public QR page (no auth) — shareable link that displays QR code
app.get('/qr/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).send('Database is starting. Please retry in a moment.');
    }
    const session = await Session.findOne({ sessionId: req.params.id });
    if (!session) return res.status(404).send('Session not found');
    const qrState = await whatsappService.waitForSessionQr(req.params.id, io);
    const rawQrData = String(qrState?.qr || session.qr || '');
    const qrData = rawQrData.startsWith('data:image/') ? escapeHtml(rawQrData) : '';
    const sessionName = escapeHtml(session.name || 'WhatsApp Session');
    const currentStatus = qrState?.status || session.status;
    const status = ['connecting', 'connected', 'disconnected'].includes(currentStatus) ? currentStatus : 'disconnected';
    res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Connect WhatsApp — ${sessionName}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f0f1a;color:#fff;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}.card{background:#1a1a2e;border-radius:24px;padding:40px;max-width:420px;width:100%;text-align:center;border:1px solid rgba(255,255,255,.08);box-shadow:0 20px 60px rgba(0,0,0,.5)}h1{font-size:22px;margin-bottom:8px}h2{color:#9ca3af;font-size:14px;font-weight:400;margin-bottom:24px}.qr-box{background:#fff;border-radius:16px;padding:16px;margin-bottom:20px;display:${qrData ? 'block' : 'none'}}.qr-box img{width:100%;max-width:280px;height:auto;display:block;margin:0 auto}.status{display:inline-block;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:500;margin-bottom:20px}.status-connecting{background:rgba(234,179,8,.15);color:#eab308}.status-connected{background:rgba(34,197,94,.15);color:#22c55e}.status-disconnected{background:rgba(107,114,128,.15);color:#6b7280}.steps{text-align:left;background:rgba(255,255,255,.05);border-radius:12px;padding:16px;margin-top:16px}.steps ol{margin:0;padding-left:20px}.steps li{color:#9ca3af;font-size:13px;line-height:1.8}.icon{font-size:48px;margin-bottom:16px}@media(max-width:480px){.card{padding:24px}}</style></head><body><div class="card"><div class="icon">📱</div><h1>${sessionName}</h1><h2>WhatsApp Connection</h2><div class="status status-${status}">${status === 'connected' ? 'Connected' : status === 'connecting' ? 'Awaiting Scan' : 'Disconnected'}</div>${qrData ? `<div class="qr-box"><img src="${qrData}" alt="QR Code"/></div>` : '<p style="color:#6b7280;padding:20px">No QR code available. Please refresh the QR from the dashboard.</p>'}${status !== 'connected' ? `<div class="steps"><ol><li>Open <strong>WhatsApp</strong> on your phone</li><li>Tap <strong>Menu</strong> (3 dots) or <strong>Settings</strong></li><li>Go to <strong>Linked Devices</strong></li><li>Tap <strong>Link a Device</strong></li><li>Scan this <strong>QR code</strong></li></ol></div>` : '<p style="color:#22c55e;font-weight:500">✅ This device is already connected</p>'}</div></body></html>`);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, {
    maxAge: '7d',
    immutable: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else if (filePath.match(/\.(js|css|webp|png|jpg|jpeg|svg|ico)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));
  app.get('*', (req, res) => {
    const isApiRequest = req.path === '/api' || req.path.startsWith('/api/');
    if (isApiRequest) {
      return res.status(404).json({ success: false, message: 'API route not found' });
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
  console.log('Serving frontend from:', frontendDist);
}

app.use(errorHandler);

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join:session', async (sessionId) => {
    if (!sessionId) return;
    socket.join(`session_${sessionId}`);
    try {
      const session = await Session.findOne({ sessionId }).select('qr status phone');
      if (session?.qr) {
        socket.emit('qr:generated', { sessionId, qr: session.qr });
      }
      if (session?.status) {
        const status = session.qr && session.status !== 'connected' ? 'connecting' : session.status;
        socket.emit('session:update', { sessionId, status, phone: session.phone || '' });
      }
    } catch (err) {
      console.error(`join:session ${sessionId} error:`, err.message);
    }
  });

  socket.on('join:campaign', (campaignId) => {
    if (!campaignId) return;
    socket.join(`campaign_${campaignId}`);
  });

  socket.on('join:user', (userId) => {
    if (!userId) return;
    const token = socket.handshake?.auth?.token || socket.handshake?.query?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const decodedUserId = decoded.id || decoded._id;
        if (decodedUserId === userId || decoded.role === 'admin' || decoded.role === 'super_admin') {
          socket.join(`user_${userId}`);
        }
      } catch {
        socket.emit('error', { message: 'Unauthorized' });
      }
    }
  });

  socket.on('join:admin', () => {
    const token = socket.handshake?.auth?.token || socket.handshake?.query?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role === 'admin' || decoded.role === 'super_admin') {
          socket.join('admin_room');
        }
      } catch {
        socket.emit('error', { message: 'Unauthorized' });
      }
    }
  });

  socket.on('call:offer', ({ room, userId, type, fromName }) => {
    io.to(`user_${userId}`).emit('call:incoming', { room, type, from: fromName || 'Admin' });
  });

  socket.on('call:accept', ({ room, userId }) => {
    io.to(`user_${userId}`).emit('call:accepted', { room });
  });

  socket.on('call:end', ({ userId }) => {
    if (userId) io.to(`user_${userId}`).emit('call:ended');
    io.to('admin_room').emit('call:ended');
  });

  socket.on('call:ringing', ({ userId }) => {
    io.to(`user_${userId}`).emit('call:ringing');
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-marketing';

function startServer() {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      if (err.code === 'EADDRINUSE') {
        err.message = `Port ${PORT} is already in use. Stop the existing backend process before starting another one.`;
      }
      reject(err);
    };

    server.once('error', onError);
    server.listen(PORT, () => {
      server.off('error', onError);
      console.log(`Server running on port ${PORT}`);
      console.log(`API: http://localhost:${PORT}/api`);
      console.log(`Health: http://localhost:${PORT}/api/health`);
      if (process.env.CLEANUP_ENABLED === 'true') {
        try { startCleanupSchedule(); } catch (err) { console.error('Cleanup schedule error:', err); }
      }
      resolve();
    });
  });
}

async function connectDB() {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    bufferCommands: false
  });
  console.log('MongoDB connected successfully');
}

async function bootstrapDatabase() {
  const retryMs = parseInt(process.env.DB_RETRY_MS || '10000', 10);

  while (true) {
    dbState.attempts += 1;
    dbState.status = 'connecting';
    dbState.lastError = null;

    try {
      await connectDB();
      dbState.status = 'connected';
      dbState.connected = true;
      dbState.lastConnectedAt = new Date().toISOString();

      await seedAll();
      await aiService.loadAIKeysFromDB();
      schedulerService.startScheduler(io).catch((err) => console.error('Scheduler start error:', err));

      setTimeout(async () => {
        try {
          if (process.env.RESTORE_WHATSAPP_SESSIONS !== 'false') {
            await whatsappService.restoreSessions(io);
          }
        } catch (err) {
          console.error('Session restoration error:', err.message);
        }
      }, 1000);

      return;
    } catch (err) {
      dbState.status = 'disconnected';
      dbState.connected = false;
      dbState.lastError = err.message;
      console.error(`MongoDB connection failed (attempt ${dbState.attempts}):`, err.message);
      console.error(`Retrying MongoDB connection in ${retryMs / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, retryMs));
    }
  }
}

mongoose.connection.on('disconnected', () => {
  dbState.status = 'disconnected';
  dbState.connected = false;
});

startServer()
  .then(() => bootstrapDatabase())
  .catch((err) => {
    console.error('FATAL:', err.message);
    process.exit(1);
  });
