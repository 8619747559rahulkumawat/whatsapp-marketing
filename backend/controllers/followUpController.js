const FollowUp = require('../models/FollowUp');
const Message = require('../models/Message');
const Campaign = require('../models/Campaign');
const Session = require('../models/Session');
const whatsappService = require('../services/whatsappService');
const Contact = require('../models/Contact');
const { calculatePagination } = require('../utils/helpers');

exports.getRules = async (req, res) => {
  try {
    const { skip, limit, page } = calculatePagination(req.query.page, req.query.limit);
    const filter = { tenantId: req.tenant._id };
    const [rules, totalCount] = await Promise.all([
      FollowUp.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      FollowUp.countDocuments(filter)
    ]);
    res.json({ success: true, rules, pagination: { page, limit, total: totalCount, pages: Math.ceil(totalCount / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createRule = async (req, res) => {
  try {
    const rule = await FollowUp.create({ ...req.body, tenantId: req.tenant._id, userId: req.user._id });
    res.status(201).json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateRule = async (req, res) => {
  try {
    const rule = await FollowUp.findOneAndUpdate(
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
    await FollowUp.findOneAndDelete({ _id: req.params.id, tenantId: req.tenant._id });
    res.json({ success: true, message: 'Rule deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.runFollowUp = async (req, res) => {
  try {
    const rule = await FollowUp.findOne({ _id: req.params.id, tenantId: req.tenant._id });
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });

    const session = rule.sessionId ? await Session.findById(rule.sessionId) : await Session.findOne({ tenantId: req.tenant._id });
    if (!session) return res.status(400).json({ success: false, message: 'No session found' });

    const cutoff = new Date(Date.now() - rule.waitHours * 3600000);
    let sent = 0, skipped = 0;

    const filter = { tenantId: req.tenant._id, status: { $in: ['sent', 'delivered'] }, sentAt: { $lte: cutoff } };
    if (rule.campaignId) filter.campaignId = rule.campaignId;
    else if (req.body.campaignId) filter.campaignId = req.body.campaignId;

    const sentMessages = await Message.find(filter).limit(50);

    for (const msg of sentMessages) {
      try {
        const hasReply = await Message.findOne({ to: msg.to, status: 'received', sentAt: { $gt: msg.sentAt } });
        if (hasReply) { skipped++; continue; }

        const contact = await Contact.findOne({ phone: msg.to, tenantId: req.tenant._id }).select('name').lean();
        const contactName = contact?.name || msg.to;
        const followUpMsg = rule.message.replace(/{name}/g, contactName);
        await whatsappService.sendTextMessage(session.sessionId, msg.to, followUpMsg);
        sent++;
      } catch { skipped++; }
    }

    rule.lastRunAt = new Date();
    await rule.save();

    res.json({ success: true, sent, skipped });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
