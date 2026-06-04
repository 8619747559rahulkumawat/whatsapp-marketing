const axios = require('axios');
const { OpenAI } = require('openai');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const KnowledgeBase = require('../models/KnowledgeBase');
const Setting = require('../models/Setting');

let openaiClient = null;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'tinyllama';

let aiAvailable = null;
let aiCheckTime = 0;
const AI_CHECK_TTL = 30000;

const FAST_REPLIES = [
  "I can help you with WhatsApp marketing! Try asking: How to create a campaign? How to import contacts? Best time to send messages?",
  "Ask me about: campaign setup, message templates, contact management, WhatsApp sessions, or automation workflows.",
  "I'm your AI marketing assistant. Try: 'Create a welcome campaign' or 'How to analyze campaign reports?'",
  "Need help? Ask about: bulk messaging, contact groups, auto-reply rules, follow-up sequences, or CRM features.",
  "I can guide you through: setting up WhatsApp sessions, creating broadcast campaigns, and tracking message delivery.",
];

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    if (!openaiClient) {
      openaiClient = new OpenAI({ apiKey, timeout: 10000, maxRetries: 2 });
    }
    return openaiClient;
  }
  return null;
};

const setOpenAIKey = (apiKey) => {
  process.env.OPENAI_API_KEY = apiKey;
  openaiClient = null;
  aiAvailable = null;
  getOpenAIClient();
};

const loadOpenAIKeyFromDB = async () => {
  try {
    const setting = await Setting.findOne({ key: 'openai_api_key' }).sort({ createdAt: -1 });
    if (setting && setting.value) {
      setOpenAIKey(setting.value);
      console.log('OpenAI API key loaded from database');
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to load OpenAI key from DB:', err.message);
    return false;
  }
};

const fastCheckAI = async () => {
  const now = Date.now();
  if (aiAvailable !== null && now - aiCheckTime < AI_CHECK_TTL) return aiAvailable;
  const client = getOpenAIClient();
  if (client) {
    try {
      await client.models.list({ timeout: 3000 });
      aiAvailable = 'openai';
      aiCheckTime = now;
      return aiAvailable;
    } catch { aiAvailable = null; }
  }
  try {
    await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 2000 });
    aiAvailable = 'ollama';
    aiCheckTime = now;
    return aiAvailable;
  } catch {
    aiAvailable = null;
    aiCheckTime = now;
    return null;
  }
};

const extractTextFromPDF = async (buffer) => {
  const data = await pdfParse(buffer);
  return data.text;
};

const chunkText = (text, chunkSize = 500, overlap = 50) => {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.substring(i, end));
    i += chunkSize - overlap;
  }
  return chunks;
};

const generateEmbedding = async (text) => {
  const client = getOpenAIClient();
  if (client) {
    try {
      const response = await client.embeddings.create({ model: 'text-embedding-ada-002', input: text });
      return response.data[0].embedding;
    } catch { return []; }
  }
  return [];
};

const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

const searchKnowledgeBase = async (query, tenantId, topK = 5) => {
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding || queryEmbedding.length === 0) return [];
  const docs = await KnowledgeBase.find({ tenantId, status: 'ready', isActive: true, 'chunks.embedding': { $exists: true, $not: { $size: 0 } } }).lean();
  const results = [];
  for (const doc of docs) {
    for (const chunk of doc.chunks) {
      if (chunk.embedding && chunk.embedding.length > 0) {
        const score = cosineSimilarity(queryEmbedding, chunk.embedding);
        if (score > 0.5) results.push({ text: chunk.text, score, source: doc.name, type: doc.type });
      }
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
};

const generateAIResponse = async (prompt, context = '', model = 'auto') => {
  const provider = await fastCheckAI();
  if (!provider) return FAST_REPLIES[Math.floor(Math.random() * FAST_REPLIES.length)];

  const client = getOpenAIClient();
  if (client && provider === 'openai' && model !== 'ollama') {
    try {
      const messages = [];
      if (context) messages.push({ role: 'system', content: context });
      messages.push({ role: 'user', content: prompt });
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages, temperature: 0.7, max_tokens: 500
      });
      return response.choices[0]?.message?.content?.trim() || FAST_REPLIES[0];
    } catch (err) {
      if (err.code === 'insufficient_quota' || err.status === 429) return 'AI service quota exceeded.';
      if (process.env.FALLBACK_TO_OLLAMA === 'true') return generateWithOllama(prompt, context);
      return FAST_REPLIES[Math.floor(Math.random() * FAST_REPLIES.length)];
    }
  }

  if (provider === 'ollama') return generateWithOllama(prompt, context);
  return FAST_REPLIES[Math.floor(Math.random() * FAST_REPLIES.length)];
};

const generateWithOllama = async (prompt, context = '') => {
  try {
    const { data } = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: OLLAMA_MODEL, prompt: `${context}\n\nUser: ${prompt}\nAssistant:`, stream: false,
      options: { temperature: 0.7, max_tokens: 300 }
    }, { timeout: 10000 });
    return data.response?.trim() || FAST_REPLIES[0];
  } catch {
    aiAvailable = null;
    return FAST_REPLIES[Math.floor(Math.random() * FAST_REPLIES.length)];
  }
};

const generateKnowledgeReply = async (message, tenantId, sessionHistory = []) => {
  const relevantDocs = await searchKnowledgeBase(message, tenantId);
  let context = 'You are a helpful customer support assistant for a business. Answer questions based ONLY on the provided knowledge base content. If the answer is not in the knowledge base, say you cannot answer.';
  if (relevantDocs.length > 0) {
    context += '\n\nRelevant knowledge base content:\n';
    relevantDocs.forEach((doc, i) => { context += `\n[${i + 1}] From "${doc.source}": ${doc.text}`; });
  }
  const history = sessionHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n');
  return generateAIResponse(message, `${context}\n\nConversation history:\n${history}`);
};

const generateSmartReply = async (message, conversationHistory = []) => {
  const history = conversationHistory.slice(-5).map(m => `${m.role || 'user'}: ${m.content}`).join('\n');
  return generateAIResponse(
    `Generate a professional WhatsApp business reply for: "${message}"`,
    `Previous conversation:\n${history}\n\nYou are a helpful WhatsApp business assistant.`
  );
};

const analyzeSentiment = async (message) => {
  const provider = await fastCheckAI();
  if (!provider) return 'neutral';
  const client = getOpenAIClient();
  if (client && provider === 'openai') {
    try {
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'system', content: 'Analyze sentiment. Respond with ONLY one word: positive, negative, or neutral.' }, { role: 'user', content: message }],
        temperature: 0.3, max_tokens: 10
      });
      const s = response.choices[0]?.message?.content?.trim().toLowerCase() || 'neutral';
      if (['positive', 'negative', 'neutral'].includes(s)) return s;
    } catch { return 'neutral'; }
  }
  if (provider === 'ollama') {
    try {
      const { data } = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
        model: OLLAMA_MODEL, prompt: `Analyze sentiment, respond with ONLY one word (positive, negative, neutral): "${message}"`,
        stream: false, options: { temperature: 0.3, max_tokens: 10 }
      }, { timeout: 5000 });
      const s = data.response?.trim().toLowerCase() || 'neutral';
      if (['positive', 'negative', 'neutral'].includes(s)) return s;
    } catch { return 'neutral'; }
  }
  return 'neutral';
};

const optimizeMessage = async (message, targetAudience = 'general') => {
  return generateAIResponse(
    `Optimize this WhatsApp marketing message for better engagement (target: ${targetAudience}):\n"${message}"\nProvide improved version only.`
  );
};

const generateChatResponse = async (message, sessionContext = '') => {
  return generateAIResponse(message, `You are a helpful WhatsApp marketing assistant. Be concise.\n${sessionContext}`);
};

const generateSuggestion = async (context) => {
  return generateAIResponse(`Based on this context, suggest next best action for WhatsApp campaign:\n${JSON.stringify(context)}\nBrief actionable suggestion.`);
};

const detectIntent = async (message, intents = []) => {
  const provider = await fastCheckAI();
  const intentList = intents.map(i => `- "${i.name}": ${i.description || i.name}`).join('\n');
  if (provider === 'openai') {
    const client = getOpenAIClient();
    if (client) {
      try {
        const response = await client.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [{ role: 'system', content: `Classify intent. Respond with ONLY intent name or "unknown".\nIntents:\n${intentList}` }, { role: 'user', content: message }],
          temperature: 0.3, max_tokens: 50
        });
        return response.choices[0]?.message?.content?.trim() || 'unknown';
      } catch { return 'unknown'; }
    }
  }
  return 'unknown';
};

const extractEntities = async (message) => {
  const entities = { email: null, phone: null, name: null, city: null, orderId: null };
  const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  const orderMatch = message.match(/(?:order|ORD|#)\s*[#]?(\d{4,10})/gi);
  if (emailMatch) entities.email = emailMatch[0];
  if (orderMatch) entities.orderId = orderMatch[0].replace(/[^0-9]/g, '');
  return entities;
};

module.exports = {
  generateSmartReply, analyzeSentiment, optimizeMessage,
  generateChatResponse, generateSuggestion, generateAIResponse,
  generateKnowledgeReply, setOpenAIKey, getOpenAIClient,
  generateEmbedding, searchKnowledgeBase, chunkText,
  extractTextFromPDF, detectIntent, extractEntities, fastCheckAI,
  loadOpenAIKeyFromDB
};
