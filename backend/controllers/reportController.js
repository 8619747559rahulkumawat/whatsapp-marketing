const Message = require('../models/Message');
const Campaign = require('../models/Campaign');
const { calculatePagination } = require('../utils/helpers');

exports.getDashboardStats = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    const [
      totalMessages,
      sentMessages,
      deliveredMessages,
      failedMessages,
      totalCampaigns,
      activeSessions,
      totalContacts
    ] = await Promise.all([
      Message.countDocuments(filter),
      Message.countDocuments({ ...filter, status: { $in: ['sent', 'delivered', 'read'] } }),
      Message.countDocuments({ ...filter, status: { $in: ['delivered', 'read'] } }),
      Message.countDocuments({ ...filter, status: 'failed' }),
      Campaign.countDocuments(filter),
      require('../models/Session').countDocuments({ ...(req.user.role !== 'admin' ? { userId: req.user._id } : {}), status: 'connected' }),
      require('../models/Contact').countDocuments(filter)
    ]);
    
    // For admin dashboard stats, we're already showing only aggregated/system-level data
    // which is appropriate for admin viewing
    res.json({
      success: true,
      stats: {
        totalMessages,
        sentMessages,
        deliveredMessages,
        failedMessages,
        totalCampaigns,
        activeSessions,
        totalContacts,
        deliveryRate: totalMessages > 0 ? ((deliveredMessages / totalMessages) * 100).toFixed(1) : 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDeliveryReports = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    const { skip, limit, page } = calculatePagination(req.query.page, req.query.limit);
    if (req.query.status) filter.status = req.query.status;
    if (req.query.campaignId) filter.campaignId = req.query.campaignId;
    const messages = await Message.find(filter)
      .populate('campaignId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // If user is admin, hide sensitive message content for other users' messages
    if (req.user.role === 'admin') {
      const sanitizedMessages = messages.map(msg => {
        // Convert to plain object to avoid modifying original Mongoose document
        const msgObj = msg.toObject ? msg.toObject() : { ...msg };
        
        // If message belongs to another user, hide sensitive content
        if (msgObj.userId && msgObj.userId.toString() !== req.user._id.toString()) {
          // Hide potentially sensitive data, keeping only essential system-level info
          msgObj.content = '[Private Message]';
          msgObj.mediaUrl = '';
          msgObj.waMessageId = '';
          msgObj.recipientJid = '';
          msgObj.to = '[Private]';
          // Keep status for system monitoring
          // Keep messageType for system monitoring
          // Keep timestamps for system monitoring
        }
        
        return msgObj;
      });
      
      const total = await Message.countDocuments(filter);
      res.json({
        success: true,
        messages: sanitizedMessages,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      });
    } else {
      const total = await Message.countDocuments(filter);
      res.json({
        success: true,
        messages,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCampaignReports = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    const campaigns = await Campaign.find(filter)
      .populate('sessionId', 'name phoneNumber')
      .sort({ createdAt: -1 });
    
    // If user is admin, hide sensitive campaign data for other users' campaigns
    if (req.user.role === 'admin') {
      const sanitizedCampaigns = campaigns.map(campaign => {
        // Convert to plain object to avoid modifying original Mongoose document
        const campaignObj = campaign.toObject ? campaign.toObject() : { ...campaign };
        
        // If campaign belongs to another user, hide sensitive fields
        if (campaignObj.userId && campaignObj.userId.toString() !== req.user._id.toString()) {
          // Hide potentially sensitive data, keeping only essential system-level info
          campaignObj.name = '[Private Campaign]';
          campaignObj.message = '[Private Message]';
          campaignObj.mediaUrl = '';
          campaignObj.contacts = []; // Hide contacts list
          campaignObj.groups = []; // Hide groups list
          campaignObj.buttons = []; // Hide buttons
          // Keep status for system monitoring
          // Keep sentCount, deliveredCount, failedCount for system monitoring
          // Keep timestamps for system monitoring
          // Keep sessionId for system monitoring (but it's already anonymized in session controller)
        }
        
        return campaignObj;
      });
      
      res.json({ success: true, campaigns: sanitizedCampaigns });
    } else {
      res.json({ success: true, campaigns });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMonthlyStats = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    filter.createdAt = { $gte: sixMonthsAgo };
    const messages = await Message.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          total: { $sum: 1 },
          sent: { $sum: { $cond: [{ $in: ['$status', ['sent', 'delivered', 'read']] }, 1, 0] } },
          delivered: { $sum: { $cond: [{ $in: ['$status', ['delivered', 'read']] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    res.json({ success: true, stats: messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.exportReport = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    const { type, campaignId, status } = req.query;
    if (type === 'campaign' && campaignId) {
      filter.campaignId = campaignId;
    }
    if (status) filter.status = status;
    const messages = await Message.find(filter).populate('campaignId', 'name').lean();
    let csv = 'Date,Phone,Message,Type,Status,Sent At\n';
    for (const m of messages) {
      csv += `"${new Date(m.createdAt).toISOString()}","${m.to}","${(m.content || '').replace(/"/g, '""')}","${m.messageType}","${m.status}","${m.sentAt ? new Date(m.sentAt).toISOString() : ''}"\n`;
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
