const AutomationFlow = require('../models/AutomationFlow');
const automationService = require('../services/automationService');
const Campaign = require('../models/Campaign');

exports.getFlows = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id, userId: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    const flows = await AutomationFlow.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, flows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFlow = async (req, res) => {
  try {
    const flow = await AutomationFlow.findOne({ _id: req.params.id, tenantId: req.tenant._id });
    if (!flow) return res.status(404).json({ success: false, message: 'Flow not found' });
    res.json({ success: true, flow });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createFlow = async (req, res) => {
  try {
    const { name, description, trigger, nodes, edges, isDrip, dripConfig } = req.body;
    const flow = await AutomationFlow.create({
      tenantId: req.tenant._id,
      userId: req.user._id,
      name,
      description,
      trigger: trigger || { type: 'contact_added', config: {} },
      nodes: nodes || [],
      edges: edges || [],
      isDrip: isDrip || false,
      dripConfig: dripConfig || {}
    });
    res.status(201).json({ success: true, flow });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateFlow = async (req, res) => {
  try {
    const flow = await AutomationFlow.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!flow) return res.status(404).json({ success: false, message: 'Flow not found' });
    res.json({ success: true, flow });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteFlow = async (req, res) => {
  try {
    const flow = await AutomationFlow.findOneAndDelete({ _id: req.params.id, tenantId: req.tenant._id });
    if (!flow) return res.status(404).json({ success: false, message: 'Flow not found' });
    res.json({ success: true, message: 'Flow deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.toggleFlowStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const flow = await AutomationFlow.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { $set: { status } },
      { new: true }
    );
    if (!flow) return res.status(404).json({ success: false, message: 'Flow not found' });
    res.json({ success: true, flow });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.executeFlow = async (req, res) => {
  try {
    const { contactId } = req.body;
    const Contact = require('../models/Contact');
    const contact = contactId ? await Contact.findById(contactId) : null;
    const context = {
      userId: req.user._id,
      tenantId: req.tenant._id,
      contact,
      phone: contact?.phone || ''
    };
    automationService.executeFlow(req.params.id, context, req.app.get('io')).catch(err => {
      console.error('Flow execution error:', err);
    });
    res.json({ success: true, message: 'Flow execution started' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveCampaignFlow = async (req, res) => {
  try {
    const { nodes, edges } = req.body;
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.campaignId, tenantId: req.tenant._id },
      { $set: { automationFlow: { nodes, edges } } },
      { new: true }
    );
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
