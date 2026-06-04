require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const jwt = require('jsonwebtoken');
const errorHandler = require('./middleware/errorHandler');
const schedulerService = require('./services/schedulerService');
const { seedAll } = require('./utils/seeder');
const whatsappService = require('./services/whatsappService');
const { startCleanupSchedule } = require('./services/cleanupScheduleService');
const aiService = require('./services/aiService');

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

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { success: false, message: 'Too many requests, please try again later' }
});

app.use(require('compression')());
app.use(require('helmet')({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api/', limiter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const sessionsDir = path.join(__dirname, process.env.SESSIONS_DIR || 'sessions');
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

app.use('/api/auth', require('./routes/auth'));
app.use('/api/sessions', require('./routes/sessions'));
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

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'RSendix.pro API is running', timestamp: new Date().toISOString() });
});

// Public QR page (no auth) — shareable link that displays QR code
const Session = require('./models/Session');
app.get('/qr/:id', async (req, res) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.id });
    if (!session) return res.status(404).send('Session not found');
    const qrData = session.qr || session.qrCode || '';
    res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Connect WhatsApp — ${session.name}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f0f1a;color:#fff;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}.card{background:#1a1a2e;border-radius:24px;padding:40px;max-width:420px;width:100%;text-align:center;border:1px solid rgba(255,255,255,.08);box-shadow:0 20px 60px rgba(0,0,0,.5)}h1{font-size:22px;margin-bottom:8px}h2{color:#9ca3af;font-size:14px;font-weight:400;margin-bottom:24px}.qr-box{background:#fff;border-radius:16px;padding:16px;margin-bottom:20px;display:${qrData ? 'block' : 'none'}}.qr-box img{width:100%;max-width:280px;height:auto;display:block;margin:0 auto}.status{display:inline-block;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:500;margin-bottom:20px}.status-connecting{background:rgba(234,179,8,.15);color:#eab308}.status-connected{background:rgba(34,197,94,.15);color:#22c55e}.status-disconnected{background:rgba(107,114,128,.15);color:#6b7280}.steps{text-align:left;background:rgba(255,255,255,.05);border-radius:12px;padding:16px;margin-top:16px}.steps ol{margin:0;padding-left:20px}.steps li{color:#9ca3af;font-size:13px;line-height:1.8}.icon{font-size:48px;margin-bottom:16px}@media(max-width:480px){.card{padding:24px}}</style></head><body><div class="card"><div class="icon">📱</div><h1>${session.name}</h1><h2>WhatsApp Connection</h2><div class="status status-${session.status || 'disconnected'}">${session.status === 'connected' ? 'Connected' : session.status === 'connecting' ? 'Awaiting Scan' : 'Disconnected'}</div>${qrData ? `<div class="qr-box"><img src="${qrData}" alt="QR Code"/></div>` : '<p style="color:#6b7280;padding:20px">No QR code available. Please refresh the QR from the dashboard.</p>'}${session.status !== 'connected' ? `<div class="steps"><ol><li>Open <strong>WhatsApp</strong> on your phone</li><li>Tap <strong>Menu</strong> (3 dots) or <strong>Settings</strong></li><li>Go to <strong>Linked Devices</strong></li><li>Tap <strong>Link a Device</strong></li><li>Scan this <strong>QR code</strong></li></ol></div>` : '<p style="color:#22c55e;font-weight:500">✅ This device is already connected</p>'}</div></body></html>`);
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

  socket.on('join:session', (sessionId) => {
    if (!sessionId) return;
    socket.join(`session_${sessionId}`);
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
        if (decoded._id === userId || decoded.role === 'admin' || decoded.role === 'super_admin') {
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

      try { schedulerService.startScheduler(); } catch (err) { console.error('Scheduler start error:', err); }
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

connectDB()
  .then(async () => {
    await seedAll();
    await aiService.loadOpenAIKeyFromDB();
    await startServer();
    setTimeout(async () => {
      try {
        if (process.env.RESTORE_WHATSAPP_SESSIONS !== 'false') {
          await whatsappService.restoreSessions(io);
        }
      } catch (err) {
        console.error('Session restoration error:', err.message);
      }
    }, 1000);
  })
  .catch((err) => {
    console.error('FATAL:', err.message);
    process.exit(1);
  });
