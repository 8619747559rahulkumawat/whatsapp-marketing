const express = require('express');
const router = express.Router();
const emailSyncController = require('../controllers/emailSyncController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth, tenantMiddleware);

// Public webhook endpoint for external email providers (SendGrid Inbound Parse, etc.)
// Uses shared secret for verification instead of user auth
router.post('/receive', (req, res, next) => {
  const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET;
  if (webhookSecret && req.headers['x-webhook-secret'] === webhookSecret) {
    req.user = { _id: null, role: 'system' };
    req.tenant = { _id: null };
    return emailSyncController.receiveEmail(req, res);
  }
  next();
}, auth, tenantMiddleware, emailSyncController.receiveEmail);

module.exports = router;
