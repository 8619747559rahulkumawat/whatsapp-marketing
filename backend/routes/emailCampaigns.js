const express = require('express');
const router = express.Router();
const emailCampaignController = require('../controllers/emailCampaignController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth, tenantMiddleware);

router.get('/', emailCampaignController.getCampaigns);
router.post('/', emailCampaignController.createCampaign);
router.get('/:id', emailCampaignController.getCampaign);
router.put('/:id', emailCampaignController.updateCampaign);
router.delete('/:id', emailCampaignController.deleteCampaign);
router.post('/:id/send', emailCampaignController.sendCampaign);

// Public tracking routes (no auth)
const publicRouter = express.Router();
publicRouter.get('/track/open/:id', emailCampaignController.trackOpen);
publicRouter.get('/track/click/:id', emailCampaignController.trackClick);

module.exports = router;
module.exports.publicRouter = publicRouter;
