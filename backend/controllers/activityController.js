const Activity = require('../models/Activity');

exports.getActivities = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    if (req.query.contactId) filter.contactId = req.query.contactId;
    if (req.query.dealId) filter.dealId = req.query.dealId;
    if (req.query.type) filter.type = req.query.type;
    if (req.user.role !== 'admin') filter.userId = req.user._id;
    const activities = await Activity.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(req.query.limit) || 100);
    res.json({ success: true, activities });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createActivity = async (req, res) => {
  try {
    const activity = await Activity.create({
      ...req.body,
      tenantId: req.tenant._id,
      userId: req.user._id
    });
    res.status(201).json({ success: true, activity });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteActivity = async (req, res) => {
  try {
    const activity = await Activity.findByIdAndDelete(req.params.id);
    if (!activity) return res.status(404).json({ success: false, message: 'Activity not found' });
    res.json({ success: true, message: 'Activity deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
