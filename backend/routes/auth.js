const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

// Public routes (no auth required)
router.post('/login', authController.login);
router.post('/register', authController.register);

// Protected routes
router.use(auth);
router.use('/me', tenantMiddleware);
router.use('/profile', tenantMiddleware);
router.use('/change-password', tenantMiddleware);

router.get('/me', authController.getMe);
router.put('/profile', authController.updateProfile);
router.post('/change-password', authController.changePassword);

module.exports = router;
