const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const { authLimiter } = require('../middleware/rateLimiter');

// Public routes (no auth required)
router.post('/login', authLimiter, authController.login);
router.post('/register', authLimiter, authController.register);

// Protected routes
router.use(auth);
router.use('/me', tenantMiddleware);
router.use('/profile', tenantMiddleware);
router.use('/change-password', tenantMiddleware);

router.get('/me', authController.getMe);
router.put('/profile', authController.updateProfile);
router.post('/change-password', authController.changePassword);
router.put('/change-password', authController.changePassword);

module.exports = router;
