const AutomationFlow = require('../models/AutomationFlow');
const aiService = require('./aiService');

const intentCache = new Map();
const CACHE_TTL = 60000;

const getIntentFlows = async (tenantId) => {
  const cacheKey = `intent_flows_${tenantId}`;
  const cached = intentCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.flows;

  const flows = await AutomationFlow.find({
    tenantId,
    status: 'active',
    'trigger.type': 'message_received'
  }).lean();

  const intentFlows = flows.filter(f => f.trigger?.config?.intentDetection);

  intentCache.set(cacheKey, { flows: intentFlows, ts: Date.now() });
  return intentFlows;
};

const matchIntent = async (message, tenantId) => {
  const flows = await getIntentFlows(tenantId);
  if (flows.length === 0) return null;

  const intents = flows.map(f => ({
    id: f._id.toString(),
    name: f.name,
    description: f.trigger?.config?.intentDescription || f.name,
    keywords: f.trigger?.config?.keywords || [],
    useAI: f.trigger?.config?.useAIDetection !== false
  }));

  for (const intent of intents) {
    if (intent.keywords && intent.keywords.length > 0) {
      const msgLower = message.toLowerCase();
      const matched = intent.keywords.some(kw => msgLower.includes(kw.toLowerCase()));
      if (matched) return intent;
    }
  }

  if (intents.some(i => i.useAI)) {
    const detected = await aiService.detectIntent(message, intents);
    if (detected !== 'unknown') {
      return intents.find(i => i.name === detected) || null;
    }
  }

  return null;
};

const clearCache = (tenantId) => {
  if (tenantId) {
    intentCache.delete(`intent_flows_${tenantId}`);
  } else {
    intentCache.clear();
  }
};

module.exports = { matchIntent, clearCache, getIntentFlows };
