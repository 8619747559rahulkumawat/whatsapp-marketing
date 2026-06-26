const AuditLog = require('../models/AuditLog');
const { calculatePagination } = require('../utils/helpers');

exports.getAuditLogs = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.entity || req.query.resource) filter.resource = req.query.entity || req.query.resource;
    if (req.query.startDate) filter.timestamp = { ...filter.timestamp, $gte: new Date(req.query.startDate) };
    if (req.query.endDate) filter.timestamp = { ...filter.timestamp, $lte: new Date(req.query.endDate) };
    if (req.query.days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(req.query.days));
      filter.timestamp = { ...filter.timestamp, $gte: cutoff };
    }

    const { skip, limit, page } = calculatePagination(req.query.page, req.query.limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).populate('userId', 'name email').sort({ timestamp: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter)
    ]);
    res.json({ success: true, logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAuditStats = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [totalLogs, actionDistribution, todayCount, userCountResult] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.aggregate([
        { $match: filter },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      AuditLog.countDocuments({ ...filter, timestamp: { $gte: todayStart } }),
      AuditLog.aggregate([
        { $match: filter },
        { $group: { _id: '$userId' } },
        { $count: 'count' }
      ])
    ]);
    const uniqueUsers = userCountResult[0]?.count || 0;
    const uniqueActions = actionDistribution.length;
    res.json({ success: true, stats: { totalLogs, actionDistribution, todayCount, uniqueUsers, uniqueActions } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.clearAuditLogs = async (req, res) => {
  try {
    const days = parseInt(req.query.olderThan) || 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const result = await AuditLog.deleteMany({ tenantId: req.tenant._id, timestamp: { $lt: cutoff } });
    res.json({ success: true, message: `Cleared ${result.deletedCount} logs older than ${days} days` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
