const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { auth, adminOnly } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth, tenantMiddleware);

router.get('/support/users', chatController.getSupportUsers);
router.get('/support', chatController.getSupportMessages);
router.get('/', chatController.getConversations);
router.post('/send', chatController.sendMessage);
router.put('/message/:id/read', chatController.updateMessageRead);
router.put('/read/:userId', chatController.markRead);
router.delete('/conversation/:userId', chatController.deleteConversation);
router.delete('/:id', chatController.deleteMessage);

module.exports = router;
