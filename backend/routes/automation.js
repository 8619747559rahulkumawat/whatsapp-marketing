const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automationController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const { checkCredits } = require('../middleware/rbac');
router.use(auth);
router.use(tenantMiddleware);

router.get('/', automationController.getFlows);
router.post('/', automationController.createFlow);
router.get('/:id', automationController.getFlow);
router.put('/:id', automationController.updateFlow);
router.delete('/:id', automationController.deleteFlow);
router.put('/:id/status', automationController.toggleFlowStatus);
router.post('/:id/execute', checkCredits, automationController.executeFlow);
router.post('/campaign/:campaignId', automationController.saveCampaignFlow);

module.exports = router;
