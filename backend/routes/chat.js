const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/support/users', auth, chatController.getSupportUsers);
router.get('/support', auth, chatController.getSupportMessages);
router.get('/', auth, chatController.getConversations);
router.post('/send', auth, chatController.sendMessage);
router.put('/message/:id/read', auth, chatController.updateMessageRead);
router.put('/read/:userId', auth, chatController.markRead);
router.delete('/conversation/:userId', auth, chatController.deleteConversation);
router.delete('/:id', auth, chatController.deleteMessage);

module.exports = router;
