const express = require('express');
const router = express.Router();
const leadScoreController = require('../controllers/leadScoreController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth, tenantMiddleware);

router.get('/stats', leadScoreController.getScoreStats);
router.post('/recalculate-all', leadScoreController.recalculateAll);
router.get('/', leadScoreController.getLeadScores);
router.post('/:contactId/recalculate', leadScoreController.recalculateScore);

module.exports = router;
