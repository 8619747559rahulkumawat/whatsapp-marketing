const express = require('express');
const router = express.Router();
const complianceController = require('../controllers/complianceController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

// Apply auth and tenant middleware to all routes
router.use(auth);
router.use(tenantMiddleware);

// Compliance logging routes
router.post('/', complianceController.logComplianceEvent);
router.get('/', complianceController.getComplianceLogs);
router.get('/subscribers', complianceController.getSubscribers);

// DND checking
router.get('/dnd/check/:phone', complianceController.checkDND);

// Keyword processing (for webhooks or inbound message handling)
router.post('/process-keyword', complianceController.processKeywordMessage);

// GDPR request routes
router.post('/gdpr', complianceController.gdprRequest);
router.get('/gdpr/:complianceId', complianceController.getGDPRRequestStatus);

module.exports = router;