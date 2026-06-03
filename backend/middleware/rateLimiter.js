const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 60000,
  max: 60,
  message: { success: false, message: 'Too many API requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

const messageLimiter = rateLimit({
  windowMs: 1000,
  max: 10,
  message: { success: false, message: 'Too many messages, slow down' }
});

const authLimiter = rateLimit({
  windowMs: 900000,
  max: 10,
  message: { success: false, message: 'Too many login attempts, try again later' }
});

const automationLimiter = rateLimit({
  windowMs: 60000,
  max: 30,
  message: { success: false, message: 'Too many automation requests' }
});

module.exports = { apiLimiter, messageLimiter, authLimiter, automationLimiter };
