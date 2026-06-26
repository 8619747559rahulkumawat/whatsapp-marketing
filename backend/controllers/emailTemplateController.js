const EmailTemplate = require('../models/EmailTemplate');

exports.getTemplates = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    if (req.user.role !== 'admin') filter.userId = req.user._id;
    const templates = await EmailTemplate.find(filter).sort({ updatedAt: -1 });
    res.json({ success: true, templates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTemplate = async (req, res) => {
  try {
    const template = await EmailTemplate.findOne({ _id: req.params.id, tenantId: req.tenant._id });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, template });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const allowed = ['name', 'subject', 'body', 'category'];
    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    data.tenantId = req.tenant._id;
    data.userId = req.user._id;
    const template = await EmailTemplate.create(data);
    res.status(201).json({ success: true, template });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const allowed = ['name', 'subject', 'body', 'category'];
    const updates = { updatedAt: new Date() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const template = await EmailTemplate.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id }, updates, { new: true }
    );
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, template });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    await EmailTemplate.findOneAndDelete({ _id: req.params.id, tenantId: req.tenant._id });
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
