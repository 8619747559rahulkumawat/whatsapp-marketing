const DashboardConfig = require('../models/DashboardConfig');

exports.getConfigs = async (req, res) => {
  try {
    const configs = await DashboardConfig.find({ tenantId: req.tenant._id, userId: req.user._id }).sort({ isDefault: -1 });
    res.json({ success: true, configs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createConfig = async (req, res) => {
  try {
    const config = await DashboardConfig.create({
      ...req.body, tenantId: req.tenant._id, userId: req.user._id
    });
    res.status(201).json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    const config = await DashboardConfig.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!config) return res.status(404).json({ success: false, message: 'Config not found' });
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteConfig = async (req, res) => {
  try {
    await DashboardConfig.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true, message: 'Config deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.setDefault = async (req, res) => {
  try {
    await DashboardConfig.updateMany(
      { tenantId: req.tenant._id, userId: req.user._id },
      { isDefault: false }
    );
    await DashboardConfig.findByIdAndUpdate(req.params.id, { isDefault: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
