const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const { checkCredits } = require('../middleware/rbac');
const { upload } = require('../middleware/upload');

// Apply auth and tenant middleware to all routes
router.use(auth);
router.use(tenantMiddleware);

router.get('/', messageController.getMessages);
router.get('/stats/daily', messageController.getDailyStats);
router.get('/stats/user/:userId', messageController.getUserStats);
router.post('/send', messageController.sendMessage);
router.post('/', messageController.sendMessage);
router.post('/bulk', messageController.sendBulkMessage);
router.post('/bulk-with-image', upload.single('file'), messageController.sendBulkWithImage);
router.put('/:id/status', messageController.updateMessageStatus);
router.get('/:id', messageController.getMessage);

module.exports = router;
