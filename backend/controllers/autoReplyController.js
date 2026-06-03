const AutoReply = require('../models/AutoReply');
const { calculatePagination } = require('../utils/helpers');

exports.getRules = async (req, res) => {
  try {
    const { skip, limit, page } = calculatePagination(req.query.page, req.query.limit);
    const filter = { tenantId: req.tenant._id };
    const [rules, totalCount] = await Promise.all([
      AutoReply.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AutoReply.countDocuments(filter)
    ]);
    res.json({ success: true, rules, pagination: { page, limit, total: totalCount, pages: Math.ceil(totalCount / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createRule = async (req, res) => {
  try {
    const rule = await AutoReply.create({ ...req.body, tenantId: req.tenant._id, userId: req.user._id });
    res.status(201).json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateRule = async (req, res) => {
  try {
    const rule = await AutoReply.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { $set: req.body },
      { new: true }
    );
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
    res.json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteRule = async (req, res) => {
  try {
    await AutoReply.findOneAndDelete({ _id: req.params.id, tenantId: req.tenant._id });
    res.json({ success: true, message: 'Rule deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
