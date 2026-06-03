const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const ctrl = require('../controllers/cleanupController');

router.use(auth, tenantMiddleware);

router.post('/inactive', ctrl.cleanupInactive);
router.post('/check-numbers', ctrl.checkNumbers);

module.exports = router;
