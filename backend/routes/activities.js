const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth);
router.use(tenantMiddleware);

router.get('/', activityController.getActivities);
router.post('/', activityController.createActivity);
router.delete('/:id', activityController.deleteActivity);

module.exports = router;
