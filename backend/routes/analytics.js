const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth);
router.use(tenantMiddleware);

router.get('/realtime', analyticsController.getRealtimeStats);
router.get('/funnel', analyticsController.getConversionFunnel);
router.get('/campaigns', analyticsController.getCampaignAnalytics);
router.get('/timeline', analyticsController.getTimelineStats);
router.get('/top-campaigns', analyticsController.getTopCampaigns);
router.get('/export', analyticsController.exportReport);
router.get('/messages', analyticsController.getMessageAnalytics);

module.exports = router;
