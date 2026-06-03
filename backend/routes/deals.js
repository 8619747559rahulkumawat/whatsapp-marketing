const express = require('express');
const router = express.Router();
const dealController = require('../controllers/dealController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth);
router.use(tenantMiddleware);

router.get('/stats', dealController.getDealStats);
router.post('/reorder', dealController.reorderDeals);
router.get('/', dealController.getDeals);
router.post('/', dealController.createDeal);
router.get('/:id', dealController.getDeal);
router.put('/:id', dealController.updateDeal);
router.patch('/:id/stage', dealController.updateDealStage);
router.delete('/:id', dealController.deleteDeal);

module.exports = router;
