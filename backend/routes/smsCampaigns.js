const express = require('express');
const router = express.Router();
const smsCampaignController = require('../controllers/smsCampaignController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth, tenantMiddleware);

router.get('/', smsCampaignController.getCampaigns);
router.post('/', smsCampaignController.createCampaign);
router.get('/:id', smsCampaignController.getCampaign);
router.put('/:id', smsCampaignController.updateCampaign);
router.delete('/:id', smsCampaignController.deleteCampaign);
router.post('/:id/send', smsCampaignController.sendCampaign);

module.exports = router;
