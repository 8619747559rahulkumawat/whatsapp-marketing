const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const { checkCredits } = require('../middleware/rbac');
// Apply auth and tenant middleware to all routes
router.use(auth);
router.use(tenantMiddleware);

router.get('/', campaignController.getCampaigns);
router.get('/analytics', campaignController.getCampaignAnalytics);
router.get('/:id', campaignController.getCampaign);
router.post('/', checkCredits, campaignController.createCampaign);
router.put('/:id', campaignController.updateCampaign);
router.delete('/:id', campaignController.deleteCampaign);
router.post('/:id/start', checkCredits, campaignController.startCampaign);
router.post('/:id/pause', campaignController.pauseCampaign);
router.post('/:id/resume', campaignController.resumeCampaign);
router.post('/:id/cancel', campaignController.cancelCampaign);
router.get('/:id/messages', campaignController.getCampaignMessages);

module.exports = router;
