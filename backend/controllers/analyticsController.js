const analyticsService = require('../services/analyticsService');
const Message = require('../models/Message');
const Campaign = require('../models/Campaign');

exports.getRealtimeStats = async (req, res) => {
  try {
    const stats = await analyticsService.getRealtimeStats(req.tenant._id, req.user._id);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getConversionFunnel = async (req, res) => {
  try {
    const { campaignId } = req.query;
    const funnel = await analyticsService.getConversionFunnel(req.tenant._id, req.user._id, campaignId);
    res.json({ success: true, funnel });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCampaignAnalytics = async (req, res) => {
  try {
    const result = await analyticsService.getCampaignAnalytics(req.tenant._id, req.user._id);
    res.json({ success: true, analytics: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTimelineStats = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const stats = await analyticsService.getTimelineStats(req.tenant._id, req.user._id, days);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTopCampaigns = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const campaigns = await analyticsService.getTopCampaigns(req.tenant._id, req.user._id, limit);
    res.json({ success: true, campaigns });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.exportReport = async (req, res) => {
  try {
    const format = req.query.format || 'csv';
    const data = await analyticsService.exportAnalyticsReport(req.tenant._id, req.user._id, format);
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics-report.csv');
      return res.send(data);
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMessageAnalytics = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id, userId: req.user._id };
    const [total, sent, delivered, read, failed] = await Promise.all([
      Message.countDocuments(filter),
      Message.countDocuments({ ...filter, status: { $in: ['sent', 'delivered', 'read'] } }),
      Message.countDocuments({ ...filter, status: 'delivered' }),
      Message.countDocuments({ ...filter, status: 'read' }),
      Message.countDocuments({ ...filter, status: 'failed' })
    ]);
    res.json({
      success: true,
      analytics: {
        total,
        sent,
        delivered,
        read,
        failed,
        deliveryRate: total > 0 ? parseFloat(((delivered / total) * 100).toFixed(1)) : 0,
        readRate: total > 0 ? parseFloat(((read / total) * 100).toFixed(1)) : 0,
        failureRate: total > 0 ? parseFloat(((failed / total) * 100).toFixed(1)) : 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
