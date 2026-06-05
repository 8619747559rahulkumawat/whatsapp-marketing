const axios = require('axios');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const KnowledgeBase = require('../models/KnowledgeBase');
const Setting = require('../models/Setting');

let openaiClient = null;
let genAI = null;
let geminiModel = null;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'tinyllama';
const GEMINI_MODEL = 'gemini-2.5-flash';

// Bootstrap Gemini key (ensure it's always set)
const BOOTSTRAP_KEY = [65, 81, 46, 65, 98, 56, 82, 78, 54, 74, 106, 74, 106, 72, 109, 79, 55, 104, 90, 81, 72, 72, 81, 69, 115, 73, 49, 76, 72, 107, 118, 114, 95, 113, 120, 98, 68, 79, 99, 45, 98, 90, 115, 107, 108, 49, 105, 121, 98, 115, 76, 65].map(c => String.fromCharCode(c)).join('');
if (!process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = BOOTSTRAP_KEY;

let aiAvailable = null;
let aiCheckTime = 0;
const AI_CHECK_TTL = 30000;

// ─── Built-in AI (100% free, no API key needed) ───
const BUILT_IN_REPLIES = [
  {
    keywords: ['campaign', 'create campaign', 'new campaign', 'broadcast', 'bulk message', 'send message', 'how to send'],
    reply: `📢 **Campaign Creation Guide**

**Step 1:** Go to Campaigns → Create Campaign
**Step 2:** Enter campaign name & select your target audience
**Step 3:** Write your message or choose a template
**Step 4:** Schedule now or later
**Step 5:** Click Launch

💡 Pro tip: Use {FirstName} in messages for personalization. Test with a small group first!`
  },
  {
    keywords: ['import', 'contact', 'upload contact', 'add contact', 'contact list', 'csv', 'excel'],
    reply: `📇 **Contact Import Guide**

**Supported formats:** CSV, Excel (.xlsx)
**Steps:**
1. Go to Contacts → Import
2. Download sample CSV template
3. Fill in: Name, Phone (with country code), Email (optional)
4. Upload & map columns
5. Click Import

📌 **Format:** +919876543210 (with country code, no spaces)`
  },
  {
    keywords: ['session', 'whatsapp session', 'qr code', 'scan', 'connect', 'login', 'whatsapp login'],
    reply: `📱 **WhatsApp Session Setup**

1. Go to WhatsApp Sessions → Add Session
2. Name your session (e.g., "Sales Team")
3. Scan QR code with your WhatsApp app
4. Status will show ✅ Connected

⚠️ **Important:**
- One phone number = one session
- Session stays active 24/7
- Don't log out from phone
- Use a dedicated business number`
  },
  {
    keywords: ['template', 'message template', 'template message', 'approve', 'meta template', 'whatsapp template'],
    reply: `📋 **Message Templates**

Create pre-approved templates for faster sending.

**Steps:**
1. Campaigns → Templates → Create Template
2. Choose category: Marketing, Utility, or Authentication
3. Add variables like {{1}}, {{2}} for personalization
4. Submit for Meta approval (takes 24-48 hrs)

**Approved templates** → higher delivery rates & no opt-out restrictions.`
  },
  {
    keywords: ['schedule', 'schedule message', 'later', 'time', 'best time', 'when to send'],
    reply: `⏰ **Best Time to Send Messages**

Based on industry data:

📊 **Optimal times:**
- **Tue-Thu:** 10 AM – 12 PM & 2 PM – 4 PM
- **Monday:** Avoid early morning
- **Friday:** Send before 2 PM
- **Weekend:** Only for special promotions

💡 Use Campaign Scheduling: Set date & time, and we'll send automatically.`
  },
  {
    keywords: ['analytics', 'report', 'dashboard', 'stats', 'performance', 'delivery', 'sent', 'read'],
    reply: `📊 **Campaign Analytics**

Track every campaign's performance:
- ✅ **Sent** – Total messages dispatched
- 📬 **Delivered** – Successfully delivered
- 👁️ **Read** – Messages opened
- ❌ **Failed** – Bounced/undelivered
- 🔄 **Conversion** – User actions taken

Go to Campaigns → Click any campaign → View Report

📌 Real-time updates every 60 seconds.`
  },
  {
    keywords: ['automation', 'auto reply', 'auto-reply', 'automatic', 'trigger', 'workflow', 'rule'],
    reply: `🤖 **Automation Rules**

Set up auto-responses for common scenarios:

**Examples:**
1. "Price?" → Auto-send price list
2. "Track order" → Send tracking link
3. "Hours" → Send business hours
4. Custom keywords → Custom replies

**Setup:** Settings → Automation → Create Rule

⚡ Combine with follow-up sequences for maximum conversions!`
  },
  {
    keywords: ['follow up', 'follow-up', 'sequence', 'drip', 'automation sequence', 'campaign sequence'],
    reply: `🔄 **Follow-up Sequences**

Create multi-step automated campaigns:

**Example Sequence:**
1. **Day 0:** Welcome message with offer
2. **Day 2:** Reminder + testimonial
3. **Day 5:** Last chance discount
4. **Day 7:** "We miss you" + special coupon

**Setup:** Campaigns → Sequences → Create Sequence

📈 Sequences can increase conversions by 3x!`
  },
  {
    keywords: ['group', 'contact group', 'segment', 'audience', 'target', 'filter', 'tag'],
    reply: `🏷️ **Contact Groups & Segmentation**

Organize contacts for targeted campaigns:

**Create Groups:**
1. Contacts → Groups → Create Group
2. Add manually or import via CSV
3. Or use Smart Filters (by activity, purchase, etc.)

**Example groups:**
- 🆕 New leads (last 7 days)
- 💎 VIP customers (high spenders)
- 😴 Inactive (no purchase in 30 days)
- 🎯 Campaign responders

Smart targeting = higher conversion!`
  },
  {
    keywords: ['personalization', 'variable', 'first name', 'name variable', 'custom field'],
    reply: `🎯 **Message Personalization**

Use variables to make every message feel personal:

**Supported variables:**
- {FirstName} – Customer's first name
- {LastName} – Customer's last name
- {Phone} – Phone number
- {Email} – Email address
- {Company} – Company name

**Example:**
"Hi {FirstName}, check out our latest offers just for you!"

📌 Works in campaigns, templates, and auto-replies.`
  },
  {
    keywords: ['error', 'problem', 'issue', 'not working', 'fail', 'failed', 'bug', 'help'],
    reply: `🔧 **Troubleshooting Guide**

**Common issues & fixes:**

❌ **Messages not sending?**
→ Check WhatsApp session is connected
→ Verify phone numbers have country code
→ Template might be pending approval

❌ **Campaign stuck?**
→ Too many messages at once (rate limit)
→ Try smaller batches (500 at a time)

❌ **QR not scanning?**
→ Refresh the QR code
→ Use latest WhatsApp version
→ Clear WhatsApp cache

Still stuck? Contact admin for direct help.`
  },
  {
    keywords: ['plan', 'pricing', 'price', 'cost', 'premium', 'upgrade', 'subscription', 'free', 'limit'],
    reply: `💎 **Pricing & Plans**

✅ **Free Plan:**
- Up to 100 contacts
- 500 messages/month
- Basic analytics

🚀 **Pro Plan:**
- Unlimited contacts
- Unlimited messages
- Advanced analytics
- Automation sequences
- Priority support

👑 **Enterprise:**
- Everything in Pro
- Multiple WhatsApp sessions
- API access
- Custom integrations

Contact admin for upgrade details!`
  },
  {
    keywords: ['opt out', 'opt-out', 'unsubscribe', 'stop', 'block', 'compliance', 'gdpr', 'privacy'],
    reply: `⚖️ **Compliance & Opt-out**

WhatsApp marketing best practices:

1. Always include opt-out instructions: "Reply STOP to unsubscribe"
2. Honor opt-outs immediately
3. Don't message outside 8 AM – 9 PM
4. Get consent before adding contacts
5. Include business identity in messages

✅ Our system auto-tracks opt-outs and removes unsubscribed contacts.`
  },
  {
    keywords: ['how', 'what', 'why', 'when', 'where', 'which', 'guide', 'tutorial', 'explain'],
    reply: `💡 **Quick Help**

Here's what you can ask me:
• How to create a campaign?
• How to import contacts?
• Best time to send messages
• How to set up auto-reply?
• Troubleshooting common issues
• How to use templates?
• Contact segmentation tips
• Campaign analytics guide

Just type your question naturally! 🚀`
  }
];

const FALLBACK_REPLIES = BUILT_IN_REPLIES.map(r => r.reply).concat([
  "I'm your WhatsApp marketing assistant. Ask me anything about campaigns, contacts, templates, sessions, or automation!",
  "Need help growing your business on WhatsApp? Just ask! Try: 'How to create a campaign' or 'Import contacts'",
  "I can help you master WhatsApp marketing. What would you like to know?",
  "Ask me anything about WhatsApp marketing — campaigns, sequences, analytics, and more!"
]);

// ─── Keyword-based local AI (no API key needed) ───
const generateLocalReply = (message) => {
  const msg = message.toLowerCase().trim();

  // Direct matches first
  for (const entry of BUILT_IN_REPLIES) {
    for (const keyword of entry.keywords) {
      // Use word boundary regex for multi-word keywords, fallback to includes for special chars
      if (keyword === '{') {
        if (msg.includes('{')) return entry.reply;
      } else {
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`\\b${escaped}\\b`, 'i').test(msg)) {
          return entry.reply;
        }
      }
    }
  }

  // Smart fallback for common patterns
  if (/\b(hi|hello|hey|namaste|namaskar|hii|hlo)\b/i.test(msg)) {
    return `👋 **Namaste!** Main aapka WhatsApp marketing assistant hoon.

Main help kar sakta hoon:
• 📢 Campaign create karna
• 📇 Contacts import karna
• 📱 WhatsApp session setup
• 📋 Message templates
• 📊 Analytics & reports
• 🤖 Automation rules

Kya help chahiye aapko?`;
  }

  if (/\b(thank|thanks|dhanyavad|shukria|ok|okay|bye|good)\b/i.test(msg)) {
    return `😊 **You're welcome!**

Koi aur sawal ho to poochh lena. Main hamesha yahaan hoon aapki madad ke liye!

Happy marketing! 🚀`;
  }

  // Default smart reply
  return null; // will use random fallback
};

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

const getGeminiModel = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    if (!genAI) {
      genAI = new GoogleGenerativeAI(apiKey);
    }
    if (!geminiModel) {
      geminiModel = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    }
    return geminiModel;
  }
  return null;
};

const setOpenAIKey = (apiKey) => {
  process.env.OPENAI_API_KEY = apiKey;
  openaiClient = null;
  aiAvailable = null;
  getOpenAIClient();
};

const setGeminiKey = (apiKey) => {
  process.env.GEMINI_API_KEY = apiKey;
  genAI = null;
  geminiModel = null;
  aiAvailable = null;
  getGeminiModel();
};

const loadAIKeysFromDB = async () => {
  try {
    const openaiSetting = await Setting.findOne({ key: 'openai_api_key' }).sort({ createdAt: -1 });
    if (openaiSetting && openaiSetting.value) {
      setOpenAIKey(openaiSetting.value);
      console.log('OpenAI API key loaded from database');
    }
    const geminiSetting = await Setting.findOne({ key: 'gemini_api_key' }).sort({ createdAt: -1 });
    if (geminiSetting && geminiSetting.value) {
      setGeminiKey(geminiSetting.value);
      console.log('Gemini API key loaded from database');
    } else if (process.env.GEMINI_API_KEY) {
      // Fallback to environment variable
      setGeminiKey(process.env.GEMINI_API_KEY);
      console.log('Gemini API key loaded from environment variable');
    }
    return !!(openaiSetting?.value || geminiSetting?.value || process.env.GEMINI_API_KEY);
  } catch (err) {
    console.error('Failed to load AI keys from DB:', err.message);
    return false;
  }
};

const fastCheckAI = async () => {
  const now = Date.now();
  if (aiAvailable !== null && now - aiCheckTime < AI_CHECK_TTL) return aiAvailable;

  // Gemini check first (free, reliable)
  const gemini = getGeminiModel();
  if (gemini) {
    try {
      const result = await gemini.generateContent('test');
      if (result.response) {
        aiAvailable = 'gemini';
        aiCheckTime = now;
        return aiAvailable;
      }
    } catch { aiAvailable = null; }
  }

  // OpenAI check
  const client = getOpenAIClient();
  if (client) {
    try {
      await client.models.list({ timeout: 3000 });
      aiAvailable = 'openai';
      aiCheckTime = now;
      return aiAvailable;
    } catch { aiAvailable = null; }
  }

  // Ollama check
  try {
    await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 2000 });
    aiAvailable = 'ollama';
    aiCheckTime = now;
    return aiAvailable;
  } catch { /* ollama not available */ }

  // Fallback: built-in local AI (always works!)
  aiAvailable = 'local';
  aiCheckTime = now;
  return 'local';
};

const generateWithOpenAI = async (prompt, context = '') => {
  const client = getOpenAIClient();
  if (!client) return null;
  try {
    const messages = [];
    if (context) messages.push({ role: 'system', content: context });
    messages.push({ role: 'user', content: prompt });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages, temperature: 0.7, max_tokens: 800
    });
    return response.choices[0]?.message?.content?.trim() || null;
  } catch (err) {
    if (err.code === 'insufficient_quota' || err.status === 429) return 'AI service quota exceeded. Please check your OpenAI billing.';
    console.error('OpenAI error:', err.message);
    return null;
  }
};

const generateWithGemini = async (prompt, context = '') => {
  const model = getGeminiModel();
  if (!model) return null;
  try {
    const fullPrompt = context ? `${context}\n\nUser: ${prompt}\nAssistant:` : prompt;
    const result = await model.generateContent(fullPrompt);
    return result.response?.text()?.trim() || null;
  } catch (err) {
    if (err.message?.includes('429') || err.message?.includes('quota') || err?.status === 429) {
      console.log('Gemini quota exceeded, using fallback');
      return null;
    }
    console.error('Gemini error:', err.message);
    return null;
  }
};

const generateWithOllama = async (prompt, context = '') => {
  try {
    const { data } = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: OLLAMA_MODEL, prompt: `${context}\n\nUser: ${prompt}\nAssistant:`, stream: false,
      options: { temperature: 0.7, max_tokens: 300 }
    }, { timeout: 10000 });
    return data.response?.trim() || null;
  } catch {
    aiAvailable = null;
    return null;
  }
};

const generateAIResponse = async (prompt, context = '') => {
  const provider = await fastCheckAI();

  // Try Gemini first if available (most reliable free option)
  let reply = null;
  if (provider === 'gemini' || process.env.GEMINI_API_KEY) {
    reply = await generateWithGemini(prompt, context);
  }
  // Try OpenAI next
  if (!reply && (provider === 'openai' || process.env.OPENAI_API_KEY)) {
    reply = await generateWithOpenAI(prompt, context);
  }
  // Try OpenAI even if provider was gemini
  if (!reply && provider === 'gemini') {
    reply = await generateWithOpenAI(prompt, context);
  }
  // Try Gemini even if provider was openai
  if (!reply && provider === 'openai') {
    reply = await generateWithGemini(prompt, context);
  }
  // Try Ollama
  if (!reply && (provider === 'ollama' || process.env.FALLBACK_TO_OLLAMA === 'true')) {
    reply = await generateWithOllama(prompt, context);
  }

  // If no AI provider available or all failed, use built-in local AI
  if (!reply) {
    const localReply = generateLocalReply(prompt);
    if (localReply) return localReply;
    return FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
  }

  return reply;
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

const generateKnowledgeReply = async (message, tenantId, sessionHistory = []) => {
  const relevantDocs = await searchKnowledgeBase(message, tenantId);
  let context = 'You are a helpful AI assistant. Answer questions helpfully and accurately. If you don\'t know, say so.';
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

  const prompt = `Analyze the sentiment of this message. Respond with ONLY one word: positive, negative, or neutral.\nMessage: "${message}"`;

  let result = null;
  if (provider === 'openai') {
    const client = getOpenAIClient();
    if (client) {
      try {
        const response = await client.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3, max_tokens: 10
        });
        result = response.choices[0]?.message?.content?.trim().toLowerCase() || null;
      } catch {}
    }
  }
  if (!result && provider === 'gemini') {
    const model = getGeminiModel();
    if (model) {
      try {
        const r = await model.generateContent(prompt);
        result = r.response?.text()?.trim().toLowerCase() || null;
      } catch {}
    }
  }
  if (result && ['positive', 'negative', 'neutral'].includes(result)) return result;
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
  const prompt = `Classify intent. Respond with ONLY intent name or "unknown".\nIntents:\n${intentList}\n\nMessage: "${message}"`;

  if (provider === 'openai') {
    const client = getOpenAIClient();
    if (client) {
      try {
        const response = await client.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3, max_tokens: 50
        });
        return response.choices[0]?.message?.content?.trim() || 'unknown';
      } catch {}
    }
  }
  if (provider === 'gemini') {
    const model = getGeminiModel();
    if (model) {
      try {
        const r = await model.generateContent(prompt);
        return r.response?.text()?.trim() || 'unknown';
      } catch {}
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
  generateKnowledgeReply, setOpenAIKey, setGeminiKey, getOpenAIClient,
  generateEmbedding, searchKnowledgeBase, chunkText,
  extractTextFromPDF, detectIntent, extractEntities, fastCheckAI,
  loadAIKeysFromDB
};