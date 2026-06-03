const LeadScore = require('../models/LeadScore');
const Activity = require('../models/Activity');

function calculateScore(factors) {
  let score = 0;
  score += Math.min((factors.emailOpens || 0) * 5, 20);
  score += Math.min((factors.emailClicks || 0) * 10, 20);
  score += Math.min((factors.messageReplies || 0) * 15, 25);
  score += Math.min((factors.formSubmissions || 0) * 10, 15);
  score += Math.min((factors.meetingAttendance || 0) * 15, 15);
  score += Math.min((factors.dealValue || 0) / 1000 * 2, 20);
  score += Math.min((factors.recency || 0) * 5, 10);
  return Math.min(Math.round(score), 100);
}

function getLevel(score) {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

exports.getLeadScores = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    if (req.query.contactId) filter.contactId = req.query.contactId;
    if (req.query.level) filter.level = req.query.level;
    const scores = await LeadScore.find(filter)
      .populate('contactId', 'name phone email')
      .sort({ score: -1 })
      .limit(parseInt(req.query.limit) || 50);
    res.json({ success: true, scores });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.recalculateScore = async (req, res) => {
  try {
    const { contactId } = req.params;
    const activities = await Activity.find({ tenantId: req.tenant._id, contactId });
    const deals = await require('../models/Deal').find({ tenantId: req.tenant._id, contactId });
    const factors = {
      emailOpens: activities.filter(a => a.type === 'email').length,
      emailClicks: 0,
      messageReplies: activities.filter(a => a.type === 'message').length,
      websiteVisits: 0,
      formSubmissions: activities.filter(a => a.type === 'system' && a.metadata?.formSlug).length,
      meetingAttendance: activities.filter(a => a.type === 'meeting').length,
      dealValue: deals.reduce((s, d) => s + (d.stage === 'won' ? d.value : 0), 0),
      recency: Math.min(Math.floor((Date.now() - (activities[0]?.createdAt || Date.now())) / 86400000), 30)
    };
    const score = calculateScore(factors);
    const level = getLevel(score);
    const leadScore = await LeadScore.findOneAndUpdate(
      { tenantId: req.tenant._id, contactId },
      { score, level, factors, lastActivity: activities[0]?.createdAt, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ success: true, score: leadScore });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.recalculateAll = async (req, res) => {
  try {
    const contacts = await require('../models/Contact').find({ tenantId: req.tenant._id });
    for (const contact of contacts) {
      const activities = await Activity.find({ tenantId: req.tenant._id, contactId: contact._id });
      const deals = await require('../models/Deal').find({ tenantId: req.tenant._id, contactId: contact._id });
      const factors = {
        emailOpens: activities.filter(a => a.type === 'email').length,
        emailClicks: 0,
        messageReplies: activities.filter(a => a.type === 'message').length,
        websiteVisits: 0,
        formSubmissions: activities.filter(a => a.type === 'system' && a.metadata?.formSlug).length,
        meetingAttendance: activities.filter(a => a.type === 'meeting').length,
        dealValue: deals.reduce((s, d) => s + (d.stage === 'won' ? d.value : 0), 0),
        recency: Math.min(Math.floor((Date.now() - (activities[0]?.createdAt || Date.now())) / 86400000), 30)
      };
      const score = calculateScore(factors);
      const level = getLevel(score);
      await LeadScore.findOneAndUpdate(
        { tenantId: req.tenant._id, contactId: contact._id },
        { score, level, factors, lastActivity: activities[0]?.createdAt, updatedAt: new Date() },
        { upsert: true }
      );
    }
    res.json({ success: true, message: `Recalculated scores for ${contacts.length} contacts` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getScoreStats = async (req, res) => {
  try {
    const stats = await LeadScore.aggregate([
      { $match: { tenantId: req.tenant._id } },
      { $group: { _id: '$level', count: { $sum: 1 }, avgScore: { $avg: '$score' } } }
    ]);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
