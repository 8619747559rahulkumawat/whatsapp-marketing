const Message = require('../models/Message');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const Session = require('../models/Session');
const User = require('../models/User');

exports.getRealtimeStats = async (tenantId, userId) => {
  const filter = { tenantId };
  if (userId) filter.userId = userId;

  const [totalMessages, sentMessages, deliveredMessages, readMessages, failedMessages, activeSessions] = await Promise.all([
    Message.countDocuments(filter),
    Message.countDocuments({ ...filter, status: { $in: ['sent', 'delivered', 'read'] } }),
    Message.countDocuments({ ...filter, status: { $in: ['delivered', 'read'] } }),
    Message.countDocuments({ ...filter, status: 'read' }),
    Message.countDocuments({ ...filter, status: 'failed' }),
    Session.countDocuments({ ...filter, status: 'connected' })
  ]);

  return {
    totalMessages,
    sentMessages,
    deliveredMessages,
    readMessages,
    failedMessages,
    activeSessions,
    deliveryRate: totalMessages > 0 ? parseFloat(((deliveredMessages / totalMessages) * 100).toFixed(1)) : 0,
    readRate: totalMessages > 0 ? parseFloat(((readMessages / totalMessages) * 100).toFixed(1)) : 0
  };
};

exports.getConversionFunnel = async (tenantId, userId, campaignId) => {
  const filter = { tenantId };
  if (userId) filter.userId = userId;
  if (campaignId) filter.campaignId = campaignId;

  const total = await Message.countDocuments(filter);
  const sent = await Message.countDocuments({ ...filter, status: { $in: ['sent', 'delivered', 'read'] } });
  const delivered = await Message.countDocuments({ ...filter, status: { $in: ['delivered', 'read'] } });
  const read = await Message.countDocuments({ ...filter, status: 'read' });
  const replied = await Message.countDocuments({ ...filter, status: 'replied' });

  return {
    total,
    sent,
    delivered,
    read,
    replied,
    stages: [
      { name: 'Total Sent', value: total },
      { name: 'Delivered', value: delivered },
      { name: 'Read', value: read },
      { name: 'Replied', value: replied }
    ]
  };
};

exports.getCampaignAnalytics = async (tenantId, userId) => {
  const filter = { tenantId };
  if (userId) filter.userId = userId;

  const campaigns = await Campaign.find(filter).sort({ createdAt: -1 }).lean();
  const total = campaigns.length;
  const running = campaigns.filter(c => c.status === 'running').length;
  const completed = campaigns.filter(c => c.status === 'completed').length;
  const failed = campaigns.filter(c => c.status === 'failed').length;
  const totalSent = campaigns.reduce((s, c) => s + (c.sentCount || 0), 0);
  const totalDelivered = campaigns.reduce((s, c) => s + (c.deliveredCount || 0), 0);
  const totalFailed = campaigns.reduce((s, c) => s + (c.failedCount || 0), 0);

  return { total, running, completed, failed, totalSent, totalDelivered, totalFailed, campaigns };
};

exports.getTimelineStats = async (tenantId, userId, days = 30) => {
  const filter = { tenantId };
  if (userId) filter.userId = userId;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  filter.createdAt = { $gte: startDate };

  const stats = await Message.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        total: { $sum: 1 },
        sent: { $sum: { $cond: [{ $in: ['$status', ['sent', 'delivered', 'read']] }, 1, 0] } },
        delivered: { $sum: { $cond: [{ $in: ['$status', ['delivered', 'read']] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return stats;
};

exports.getTopCampaigns = async (tenantId, userId, limit = 5) => {
  const filter = { tenantId };
  if (userId) filter.userId = userId;

  return Campaign.find(filter)
    .sort({ sentCount: -1 })
    .limit(limit)
    .select('name sentCount deliveredCount failedCount status')
    .lean();
};

exports.exportAnalyticsReport = async (tenantId, userId, format = 'csv') => {
  const stats = await this.getRealtimeStats(tenantId, userId);
  const campaigns = await this.getCampaignAnalytics(tenantId, userId);

  const sanitizeCSV = (val) => {
    const str = String(val || '');
    if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@') || str.startsWith('\t')) {
      return "'" + str;
    }
    return str;
  };

  if (format === 'csv') {
    let csv = 'Metric,Value\n';
    Object.entries(stats).forEach(([key, val]) => { csv += `${key},${val}\n`; });
    csv += '\nCampaign,Status,Sent,Delivered,Failed\n';
    campaigns.campaigns.forEach(c => {
      csv += `"${sanitizeCSV(c.name)}",${c.status},${c.sentCount || 0},${c.deliveredCount || 0},${c.failedCount || 0}\n`;
    });
    return csv;
  }

  return { stats, campaigns: campaigns.campaigns };
};
