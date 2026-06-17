const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const ctrl = require('../controllers/previewController');

router.post('/message', auth, tenantMiddleware, ctrl.previewMessage);

module.exports = router;
