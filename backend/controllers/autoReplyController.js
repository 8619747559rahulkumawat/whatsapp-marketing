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

const ALLOWED_AUTO_REPLY_FIELDS = ['name', 'keyword', 'matchType', 'replyType', 'replyText', 'mediaUrl', 'sessionId', 'isActive', 'oncePerContact'];

exports.createRule = async (req, res) => {
  try {
    const data = {};
    for (const field of ALLOWED_AUTO_REPLY_FIELDS) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }
    if (!data.keyword) {
      return res.status(400).json({ success: false, message: 'Keyword is required' });
    }
    if (!data.replyText || !data.replyText.trim()) {
      return res.status(400).json({ success: false, message: 'Reply text is required' });
    }
    data.tenantId = req.tenant._id;
    data.userId = req.user._id;
    const rule = await AutoReply.create(data);
    res.status(201).json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateRule = async (req, res) => {
  try {
    const data = {};
    for (const field of ALLOWED_AUTO_REPLY_FIELDS) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }
    if (data.replyText !== undefined && !data.replyText.trim()) {
      return res.status(400).json({ success: false, message: 'Reply text cannot be empty' });
    }
    const rule = await AutoReply.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { $set: data },
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
