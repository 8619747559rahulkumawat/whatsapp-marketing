const AutomationFlow = require('../models/AutomationFlow');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const Message = require('../models/Message');
const Session = require('../models/Session');
const User = require('../models/User');
const whatsappService = require('./whatsappService');
const axios = require('axios');

const runningAutomations = new Map();

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
      const { duration, unit } = data;
      const ms = unit === 'minutes' ? duration * 60000 : unit === 'hours' ? duration * 3600000 : duration;
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
        case 'contains': met = actualValue.includes(value); break;
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
      await axios({
        method: method || 'POST',
        url,
        headers: { 'Content-Type': 'application/json', ...headers },
        data: { ...context, ...(body ? JSON.parse(body) : {}) }
      });
      break;
    }

    case 'apiCall': {
      const { url, method, headers, body } = data;
      const response = await axios({
        method: method || 'GET',
        url,
        headers: { 'Content-Type': 'application/json', ...headers },
        data: body ? JSON.parse(body) : undefined
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

const executeFlow = async (flowId, context, io) => {
  if (runningAutomations.has(flowId)) {
    console.log(`Automation ${flowId} already running`);
    return;
  }
  runningAutomations.set(flowId, true);

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

    flow.stats.totalExecutions += 1;
    flow.stats.successfulExecutions += 1;
    flow.stats.lastExecutedAt = new Date();
    await flow.save();
  } catch (err) {
    console.error(`Automation ${flowId} error:`, err.message);
    await AutomationFlow.findByIdAndUpdate(flowId, {
      $inc: { 'stats.failedExecutions': 1 }
    });
  } finally {
    runningAutomations.delete(flowId);
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

  for (const contactId of contactIds) {
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
};

module.exports = {
  executeFlow,
  executeNode,
  triggerAutomation,
  processDripCampaign
};
