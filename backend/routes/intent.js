const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const intentService = require('../services/intentService');
const AutomationFlow = require('../models/AutomationFlow');

router.use(auth);
router.use(tenantMiddleware);

router.get('/flows', async (req, res) => {
  try {
    const flows = await AutomationFlow.find({
      tenantId: req.tenant._id,
      status: 'active',
      'trigger.type': 'message_received'
    }).select('name description trigger.nodes');
    res.json({ success: true, flows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/test', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });
    const matchedIntent = await intentService.matchIntent(message, req.tenant._id);
    res.json({ success: true, matched: !!matchedIntent, intent: matchedIntent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/flows/:id/intent-config', async (req, res) => {
  try {
    const { intentDetection, intentDescription, keywords, useAIDetection } = req.body;
    const flow = await AutomationFlow.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      {
        $set: {
          'trigger.config.intentDetection': intentDetection !== false,
          'trigger.config.intentDescription': intentDescription || '',
          'trigger.config.keywords': keywords || [],
          'trigger.config.useAIDetection': useAIDetection !== false
        }
      },
      { new: true }
    );
    if (!flow) return res.status(404).json({ success: false, message: 'Flow not found' });
    intentService.clearCache(req.tenant._id);
    res.json({ success: true, flow });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/cache', async (req, res) => {
  intentService.clearCache(req.tenant._id);
  res.json({ success: true, message: 'Intent cache cleared' });
});

module.exports = router;
