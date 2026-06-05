const AIChat = require('../models/AIChat');
const KnowledgeBase = require('../models/KnowledgeBase');
const Setting = require('../models/Setting');
const aiService = require('../services/aiService');
const fs = require('fs');
const path = require('path');

const getAIAnalytics = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant?._id || req.user.tenantId };
    const [totalChats, totalKnowledge, totalSmartReplies, recentActivity] = await Promise.all([
      AIChat.countDocuments(filter),
      KnowledgeBase.countDocuments({ ...filter, status: 'ready' }),
      AIChat.countDocuments({ ...filter, type: 'smart_reply' }),
      AIChat.find(filter).sort({ createdAt: -1 }).limit(10).lean()
    ]);
    res.json({ success: true, analytics: { totalChats, totalKnowledge, totalSmartReplies, recentActivity } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getChatHistory = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant?._id || req.user.tenantId, userId: req.user._id };
    if (req.query.sessionId) filter.sessionId = req.query.sessionId;
    const messages = await AIChat.find(filter).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, messages: messages.reverse() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const chat = async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

    const tenantId = req.tenant?._id || req.user.tenantId;
    const userId = req.user._id;
    const session = sessionId || `session_${Date.now()}`;

    AIChat.create({ tenantId, userId, role: 'user', content: message, type: 'chat', sessionId: session }).catch(() => {});

    const reply = await aiService.generateKnowledgeReply(message, tenantId, []);

    AIChat.create({ tenantId, userId, role: 'assistant', content: reply, type: 'chat', sessionId: session }).catch(() => {});

    res.json({ success: true, reply, sessionId: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const smartReply = async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });
    const reply = await aiService.generateSmartReply(message, conversationHistory || []);
    await AIChat.create({
      tenantId: req.tenant?._id || req.user.tenantId, userId: req.user._id,
      role: 'assistant', content: reply, type: 'smart_reply'
    });
    res.json({ success: true, reply });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const analyzeSentiment = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });
    const sentiment = await aiService.analyzeSentiment(message);
    await AIChat.create({
      tenantId: req.tenant?._id || req.user.tenantId, userId: req.user._id,
      role: 'system', content: JSON.stringify({ message, sentiment }), type: 'sentiment'
    });
    res.json({ success: true, sentiment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const optimizeMessage = async (req, res) => {
  try {
    const { message, targetAudience } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });
    const optimized = await aiService.optimizeMessage(message, targetAudience || 'general');
    await AIChat.create({
      tenantId: req.tenant?._id || req.user.tenantId, userId: req.user._id,
      role: 'system', content: JSON.stringify({ original: message, optimized }), type: 'optimize'
    });
    res.json({ success: true, optimized });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getSuggestions = async (req, res) => {
  try {
    const context = req.body || {};
    const suggestion = await aiService.generateSuggestion(context);
    res.json({ success: true, suggestion });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const checkOllamaStatus = async (req, res) => {
  try {
    const tenantId = req.tenant?._id || req.user.tenantId;
    const openaiSetting = await Setting.findOne({ key: 'openai_api_key', tenantId });
    let geminiSetting = await Setting.findOne({ key: 'gemini_api_key', tenantId });
    // Fallback to global key (no tenantId)
    if (!geminiSetting?.value) {
      geminiSetting = await Setting.findOne({ key: 'gemini_api_key', tenantId: { $exists: false } });
    }

    const openaiClient = aiService.getOpenAIClient();
    if (openaiClient && openaiSetting?.value) {
      try {
        const models = await openaiClient.models.list();
        const hasModel = models.data.some(m => m.id === (process.env.OPENAI_MODEL || 'gpt-4o-mini'));
        res.json({ success: true, available: true, provider: 'openai', hasModel, models: models.data.map(m => m.id), openaiConfigured: true, geminiConfigured: !!geminiSetting?.value, localAvailable: true });
        return;
      } catch {}
    }
    if (openaiSetting?.value) {
      res.json({ success: true, available: true, provider: 'openai', openaiConfigured: true, geminiConfigured: !!geminiSetting?.value, localAvailable: true, message: 'OpenAI key configured. Try saving again if not working.' });
      return;
    }
    if (geminiSetting?.value || process.env.GEMINI_API_KEY) {
      res.json({ success: true, available: true, provider: 'gemini', openaiConfigured: false, geminiConfigured: true, localAvailable: true, message: 'Google Gemini configured. Ask anything!' });
      return;
    }
    res.json({ success: true, available: true, provider: 'local', openaiConfigured: false, geminiConfigured: false, localAvailable: true, message: 'Built-in AI active! No API key needed. Ask me anything about WhatsApp marketing.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const setOpenAIKey = async (req, res) => {
  try {
    const { apiKey, key, model } = req.body;
    const openaiKey = apiKey || key;
    if (!openaiKey) return res.status(400).json({ success: false, message: 'API key is required' });
    process.env.OPENAI_API_KEY = openaiKey;
    if (model) process.env.OPENAI_MODEL = model;
    aiService.setOpenAIKey(openaiKey);
    await Setting.findOneAndUpdate(
      { key: 'openai_api_key', tenantId: req.tenant?._id || req.user.tenantId },
      { key: 'openai_api_key', value: openaiKey, tenantId: req.tenant?._id || req.user.tenantId },
      { upsert: true, new: true }
    );
    if (model) {
      await Setting.findOneAndUpdate(
        { key: 'openai_model', tenantId: req.tenant?._id || req.user.tenantId },
        { key: 'openai_model', value: model, tenantId: req.tenant?._id || req.user.tenantId },
        { upsert: true }
      );
    }
    res.json({ success: true, message: 'OpenAI API key configured successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getOpenAIKey = async (req, res) => {
  try {
    const setting = await Setting.findOne({
      key: 'openai_api_key', tenantId: req.tenant?._id || req.user.tenantId
    });
    res.json({ success: true, configured: !!setting, model: process.env.OPENAI_MODEL || 'gpt-4o-mini' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const setGeminiKey = async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ success: false, message: 'API key is required' });
    aiService.setGeminiKey(apiKey);
    await Setting.findOneAndUpdate(
      { key: 'gemini_api_key', tenantId: req.tenant?._id || req.user.tenantId },
      { key: 'gemini_api_key', value: apiKey, tenantId: req.tenant?._id || req.user.tenantId },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: 'Google Gemini API key configured successfully! AI is now ready.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getGeminiKey = async (req, res) => {
  try {
    const setting = await Setting.findOne({
      key: 'gemini_api_key', tenantId: req.tenant?._id || req.user.tenantId
    });
    res.json({ success: true, configured: !!setting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Knowledge Base Management
const getKnowledgeBases = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant?._id || req.user.tenantId, userId: req.user._id };
    const docs = await KnowledgeBase.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, knowledgeBases: docs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const uploadKnowledgeBase = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);
    let content = '';
    let type = 'txt';

    if (req.file.mimetype === 'application/pdf') {
      type = 'pdf';
      content = await aiService.extractTextFromPDF(buffer);
    } else if (req.file.mimetype === 'text/plain') {
      type = 'txt';
      content = buffer.toString('utf-8');
    } else if (req.file.mimetype.includes('word')) {
      type = 'doc';
      content = buffer.toString('utf-8');
    } else {
      content = buffer.toString('utf-8');
    }

    const chunks = aiService.chunkText(content, 500, 50);
    const chunkedDocs = [];
    for (const chunk of chunks) {
      const embedding = await aiService.generateEmbedding(chunk);
      chunkedDocs.push({ text: chunk, embedding: embedding || [], metadata: {} });
    }

    const kb = await KnowledgeBase.create({
      tenantId: req.tenant?._id || req.user.tenantId,
      userId: req.user._id,
      name: req.file.originalname,
      type,
      content: content.substring(0, 100000),
      chunks: chunkedDocs,
      filePath: `/uploads/${req.file.filename}`,
      fileSize: req.file.size,
      chunkCount: chunkedDocs.length,
      status: chunkedDocs.length > 0 ? 'ready' : 'failed'
    });

    res.json({ success: true, knowledgeBase: kb });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteKnowledgeBase = async (req, res) => {
  try {
    const kb = await KnowledgeBase.findOneAndDelete({
      _id: req.params.id, tenantId: req.tenant?._id || req.user.tenantId
    });
    if (!kb) return res.status(404).json({ success: false, message: 'Knowledge base not found' });
    if (kb.filePath) {
      const fullPath = path.join(__dirname, '..', kb.filePath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    res.json({ success: true, message: 'Knowledge base deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const searchKnowledgeBase = async (req, res) => {
  try {
    const { query, topK } = req.body;
    if (!query) return res.status(400).json({ success: false, message: 'Query is required' });
    const results = await aiService.searchKnowledgeBase(
      query, req.tenant?._id || req.user.tenantId, parseInt(topK) || 5
    );
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const trainFromWebsite = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL is required' });
    const axios = require('axios');
    const cheerio = require('cheerio');
    const { data: html } = await axios.get(url, { timeout: 15000 });
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, iframe').remove();
    const content = $('body').text().replace(/\s+/g, ' ').trim();
    const chunks = aiService.chunkText(content, 500, 50);
    const chunkedDocs = [];
    for (const chunk of chunks) {
      const embedding = await aiService.generateEmbedding(chunk);
      chunkedDocs.push({ text: chunk, embedding: embedding || [], metadata: { source: url } });
    }
    const kb = await KnowledgeBase.create({
      tenantId: req.tenant?._id || req.user.tenantId,
      userId: req.user._id,
      name: `Website: ${new URL(url).hostname}`,
      type: 'website',
      content: content.substring(0, 100000),
      chunks: chunkedDocs,
      chunkCount: chunkedDocs.length,
      status: chunkedDocs.length > 0 ? 'ready' : 'failed'
    });
    res.json({ success: true, knowledgeBase: kb });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getChatHistory, chat, smartReply, analyzeSentiment, optimizeMessage,
  getSuggestions, checkOllamaStatus, setOpenAIKey, getOpenAIKey,
  setGeminiKey, getGeminiKey,
  getKnowledgeBases, uploadKnowledgeBase, deleteKnowledgeBase,
  searchKnowledgeBase, trainFromWebsite, getAIAnalytics
};
