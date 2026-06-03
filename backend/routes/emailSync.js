const express = require('express');
const router = express.Router();
const emailSyncController = require('../controllers/emailSyncController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth, tenantMiddleware);

router.post('/receive', emailSyncController.receiveEmail);

module.exports = router;
