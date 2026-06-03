const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth);
router.use(tenantMiddleware);

router.post('/send', emailController.sendEmail);
router.get('/settings', emailController.getSettings);
router.post('/settings', emailController.saveSettings);

module.exports = router;
