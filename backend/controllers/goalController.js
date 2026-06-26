const Goal = require('../models/Goal');

exports.getGoals = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    if (req.user.role !== 'admin') filter.userId = req.user._id;
    const goals = await Goal.find(filter).populate('assignedTo', 'name email').sort({ createdAt: -1 });
    res.json({ success: true, goals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getGoal = async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, tenantId: req.tenant._id }).populate('assignedTo', 'name email');
    if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });
    res.json({ success: true, goal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createGoal = async (req, res) => {
  try {
    const goal = await Goal.create({ ...req.body, tenantId: req.tenant._id, userId: req.user._id });
    res.status(201).json({ success: true, goal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateGoal = async (req, res) => {
  try {
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id }, { ...req.body, updatedAt: new Date() }, { new: true }
    );
    if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });
    res.json({ success: true, goal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteGoal = async (req, res) => {
  try {
    const goal = await Goal.findOneAndDelete({ _id: req.params.id, tenantId: req.tenant._id });
    if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });
    res.json({ success: true, message: 'Goal deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
