const AutomationFlow = require('../models/AutomationFlow');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const Message = require('../models/Message');
const Session = require('../models/Session');
const User = require('../models/User');
const whatsappService = require('./whatsappService');
const axios = require('axios');

const runningAutomations = new Map();
const BLOCKED_HOSTS = ['127.0.0.1', 'localhost', '0.0.0.0', '::1', '10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.', '169.254.169.254'];

const validateUrl = (url) => {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.some(blocked => hostname.startsWith(blocked) || hostname === blocked)) {
      throw new Error(`Requests to ${hostname} are not allowed for security reasons`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only http and https protocols are allowed');
    }
    return true;
  } catch (err) {
    if (err.message.includes('not allowed') || err.message.includes('protocols')) throw err;
    throw new Error('Invalid URL provided');
  }
};

const safeParseJSON = (str) => {
  try { return JSON.parse(str); } catch { return {}; }
};

const executeNode = async (node, context, io) => {
  const { type, data } = node;

  switch (type) {
    case 'sendMessage': {
      const { message, templateId, sessionId, buttons } = data;
      const session = await Session.findById(sessionId || context.sessionId);
      if (!session) throw new Error('WhatsApp session not found');

      let messageContent = message;
      if (context.contact) {
        messageContent = messageContent
          .replace(/{name}/g, context.contact.name || '')
          .replace(/{phone}/g, context.contact.phone || '');
      }

      const phone = context.contact?.phone || context.phone;
      let result;
      if (buttons && buttons.length > 0) {
        result = await whatsappService.sendButtonMessage(session.sessionId, phone, messageContent, buttons);
      } else {
        result = await whatsappService.sendTextMessage(session.sessionId, phone, messageContent);
      }

      await Message.create({
        userId: context.userId,
        tenantId: session.tenantId,
        sessionId: session._id,
        to: phone,
        content: messageContent,
        status: 'sent',
        sentAt: new Date(),
        waMessageId: result?.id || ''
      });
      break;
    }

    case 'waitDelay': {
      const duration = data.duration || data.delay || 0;
      const unit = data.unit || data.delayUnit || data.timeUnit || 'seconds';
      const ms = unit === 'minutes' ? duration * 60000 : unit === 'hours' ? duration * 3600000 : (unit === 'seconds' ? duration * 1000 : duration);
      await new Promise(resolve => setTimeout(resolve, ms));
      break;
    }

    case 'condition': {
      const { field, operator, value } = data;
      let actualValue = '';
      if (context.contact && context.contact[field]) {
        actualValue = context.contact[field];
      } else if (context[field]) {
        actualValue = context[field];
      }

      let met = false;
      switch (operator) {
        case 'equals': met = actualValue === value; break;
        case 'not_equals': met = actualValue !== value; break;
        case 'contains': met = String(actualValue).includes(value); break;
        case 'greater_than': met = parseFloat(actualValue) > parseFloat(value); break;
        case 'less_than': met = parseFloat(actualValue) < parseFloat(value); break;
        case 'is_set': met = !!actualValue; break;
        case 'not_set': met = !actualValue; break;
        default: met = false;
      }
      return met ? 'true' : 'false';
    }

    case 'webhook': {
      const { url, method, headers, body } = data;
      validateUrl(url);
      await axios({
        method: method || 'POST',
        url,
        headers: { 'Content-Type': 'application/json', ...headers },
        data: { ...context, ...(body ? safeParseJSON(body) : {}) }
      });
      break;
    }

    case 'apiCall': {
      const { url, method, headers, body } = data;
      validateUrl(url);
      const response = await axios({
        method: method || 'GET',
        url,
        headers: { 'Content-Type': 'application/json', ...headers },
        data: body ? safeParseJSON(body) : undefined
      });
      context.apiResponse = response.data;
      break;
    }

    case 'tagUser': {
      const { tags, action } = data;
      if (context.contact && tags) {
        if (action === 'add') {
          await Contact.findByIdAndUpdate(context.contact._id, {
            $addToSet: { tags: { $each: tags } }
          });
        } else if (action === 'remove') {
          await Contact.findByIdAndUpdate(context.contact._id, {
            $pullAll: { tags }
          });
        }
      }
      break;
    }

    default:
      console.warn(`Unknown node type: ${type}`);
  }
};

const getRunningKey = (flowId, context) => `${flowId}:${context.contact?._id || context.phone || 'global'}:${context.userId || 'unknown'}`;

const executeFlow = async (flowId, context, io) => {
  const runningKey = getRunningKey(flowId, context);
  if (runningAutomations.has(runningKey)) {
    console.log(`Automation ${runningKey} already running`);
    return;
  }
  runningAutomations.set(runningKey, true);

  try {
    const flow = await AutomationFlow.findById(flowId);
    if (!flow || flow.status !== 'active') return;

    const { nodes, edges } = flow;
    if (!nodes || nodes.length === 0) return;

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const edgeMap = new Map();
    edges.forEach(e => {
      if (!edgeMap.has(e.source)) edgeMap.set(e.source, []);
      edgeMap.get(e.source).push(e);
    });

    let currentNodeId = nodes[0]?.id;
    const visited = new Set();
    let maxIterations = 50;

    while (currentNodeId && visited.size < maxIterations) {
      if (visited.has(currentNodeId)) break;
      visited.add(currentNodeId);

      const node = nodeMap.get(currentNodeId);
      if (!node) break;

      const result = await executeNode(node, context, io);

      const outgoingEdges = edgeMap.get(currentNodeId) || [];
      if (outgoingEdges.length === 0) break;

      if (node.type === 'condition' && result) {
        const trueEdge = outgoingEdges.find(e => e.sourceHandle === 'true');
        const falseEdge = outgoingEdges.find(e => e.sourceHandle === 'false');
        currentNodeId = result === 'true' ? trueEdge?.target : falseEdge?.target;
      } else {
        currentNodeId = outgoingEdges[0]?.target;
      }
    }

    await AutomationFlow.findByIdAndUpdate(flowId, {
      $inc: { 'stats.totalExecutions': 1, 'stats.successfulExecutions': 1 },
      $set: { 'stats.lastExecutedAt': new Date() }
    });
  } catch (err) {
    console.error(`Automation ${flowId} error:`, err.message);
    await AutomationFlow.findByIdAndUpdate(flowId, {
      $inc: { 'stats.totalExecutions': 1, 'stats.failedExecutions': 1 }
    });
  } finally {
    runningAutomations.delete(runningKey);
  }
};

const triggerAutomation = async (event, payload, io) => {
  try {
    const flows = await AutomationFlow.find({
      'trigger.type': event,
      status: 'active'
    });

    for (const flow of flows) {
      executeFlow(flow._id, payload, io).catch(err => {
        console.error(`Trigger automation ${flow._id} error:`, err);
      });
    }
  } catch (err) {
    console.error('Trigger automation error:', err);
  }
};

const processDripCampaign = async (campaignId, contactIds, io) => {
  const campaign = await Campaign.findById(campaignId).populate('contacts');
  if (!campaign || !campaign.automationFlow) return;

  const flowData = campaign.automationFlow;
  if (!flowData.isDrip) return;

  const CHUNK_SIZE = 5;
  for (let i = 0; i < contactIds.length; i += CHUNK_SIZE) {
    const chunk = contactIds.slice(i, i + CHUNK_SIZE);

    await new Promise(resolve => setImmediate(resolve));

    for (const contactId of chunk) {
      const contact = await Contact.findById(contactId);
      if (!contact) continue;

      const context = {
        userId: campaign.userId,
        sessionId: campaign.sessionId,
        contact,
        phone: contact.phone,
        campaignId: campaign._id
      };

      await executeFlow(flowData._id || campaignId, context, io);

      if (flowData.dripConfig?.interval > 0) {
        await new Promise(resolve => setTimeout(resolve, flowData.dripConfig.interval));
      }
    }
  }
};

module.exports = {
  executeFlow,
  executeNode,
  triggerAutomation,
  processDripCampaign
};
