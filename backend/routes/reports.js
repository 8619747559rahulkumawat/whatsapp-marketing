const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
router.use(auth);
router.use(tenantMiddleware);

router.get('/dashboard', reportController.getDashboardStats);
router.get('/campaigns', reportController.getCampaignReports);
router.get('/delivery', reportController.getDeliveryReports);
router.get('/monthly', reportController.getMonthlyStats);
router.get('/export', reportController.exportReport);

module.exports = router;
