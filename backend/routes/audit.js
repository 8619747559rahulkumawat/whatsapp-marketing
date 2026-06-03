const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth);
router.use(tenantMiddleware);

router.get('/', auditController.getAuditLogs);
router.get('/stats', auditController.getAuditStats);
router.delete('/clear', auditController.clearAuditLogs);

module.exports = router;
