const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth, tenantMiddleware);

router.get('/', notificationController.getNotifications);
router.post('/', notificationController.createNotification);
router.put('/:id/read', notificationController.markRead);
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
