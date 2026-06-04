const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const { upload } = require('../middleware/upload');

router.use(auth);
router.use(tenantMiddleware);

// AI Chat
router.get('/analytics', aiController.getAIAnalytics);
router.get('/chat', aiController.getChatHistory);
router.post('/chat', aiController.chat);
router.post('/smart-reply', aiController.smartReply);
router.post('/sentiment', aiController.analyzeSentiment);
router.post('/optimize', aiController.optimizeMessage);
router.post('/suggestions', aiController.getSuggestions);
router.get('/ollama-status', aiController.checkOllamaStatus);

// OpenAI Key Management
router.post('/openai-key', aiController.setOpenAIKey);
router.get('/openai-key', aiController.getOpenAIKey);

// Gemini Key Management
router.post('/gemini-key', aiController.setGeminiKey);
router.get('/gemini-key', aiController.getGeminiKey);

// Knowledge Base
router.get('/knowledge-base', aiController.getKnowledgeBases);
router.post('/knowledge-base/upload', upload.single('file'), aiController.uploadKnowledgeBase);
router.post('/knowledge-base/train-website', aiController.trainFromWebsite);
router.post('/knowledge-base/search', aiController.searchKnowledgeBase);
router.delete('/knowledge-base/:id', aiController.deleteKnowledgeBase);

module.exports = router;
