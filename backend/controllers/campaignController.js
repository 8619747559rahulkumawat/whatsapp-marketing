const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const campaignService = require('../services/campaignService');

exports.getCampaigns = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    const campaigns = await Campaign.find(filter)
      .populate('sessionId', 'name phoneNumber')
      .sort({ createdAt: -1 })
      .limit(50);
    
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

exports.getCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate('sessionId', 'name phoneNumber')
      .populate('contacts', 'name phone');
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    
    // If user is admin and campaign belongs to another user, hide sensitive data
    if (req.user.role === 'admin' && campaign.userId && campaign.userId.toString() !== req.user._id.toString()) {
      // Convert to plain object to avoid modifying original Mongoose document
      const campaignObj = campaign.toObject ? campaign.toObject() : { ...campaign };
      
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
      
      res.json({ success: true, campaign: campaignObj });
    } else {
      res.json({ success: true, campaign });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createCampaign = async (req, res) => {
  try {
    const {
      name, type, sessionId, messageType, message, mediaUrl, delay,
      minDelaySeconds, maxDelaySeconds, dailyLimit, requireOptIn,
      appendOptOut, stopOnHighFailureRate, isPersonalized,
      contactIds, groupIds, buttons, scheduledAt
    } = req.body;
    const campaign = await Campaign.create({
      userId: req.user._id,
      tenantId: req.tenant?._id || req.user.tenantId,
      name,
      type: type || 'bulk',
      sessionId,
      messageType: messageType || 'text',
      message,
      mediaUrl: mediaUrl || '',
      delay: delay || 2000,
      minDelaySeconds: Math.max(5, parseInt(minDelaySeconds || 20, 10)),
      maxDelaySeconds: Math.max(parseInt(minDelaySeconds || 20, 10), parseInt(maxDelaySeconds || 45, 10)),
      dailyLimit: Math.max(1, parseInt(dailyLimit || 200, 10)),
      requireOptIn: requireOptIn !== false,
      appendOptOut: appendOptOut !== false,
      stopOnHighFailureRate: stopOnHighFailureRate !== false,
      isPersonalized: isPersonalized || false,
      contacts: contactIds || [],
      groups: groupIds || [],
      buttons: buttons || [],
      scheduledAt: scheduledAt || null,
      status: scheduledAt ? 'scheduled' : 'draft'
    });
    res.status(201).json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCampaign = async (req, res) => {
  try {
    const allowed = ['name', 'type', 'sessionId', 'messageType', 'message', 'mediaUrl', 'delay', 'minDelaySeconds', 'maxDelaySeconds', 'dailyLimit', 'requireOptIn', 'appendOptOut', 'stopOnHighFailureRate', 'isPersonalized', 'contactIds', 'groupIds', 'buttons', 'scheduledAt', 'status'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updates,
      { new: true }
    );
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found or access denied' });
    }
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found or access denied' });
    }
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.startCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    campaignService.processCampaign(req.params.id, req.app.get('io'));
    res.json({ success: true, message: 'Campaign started' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.pauseCampaign = async (req, res) => {
  try {
    await campaignService.pauseCampaign(req.params.id);
    res.json({ success: true, message: 'Campaign paused' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resumeCampaign = async (req, res) => {
  try {
    await campaignService.resumeCampaign(req.params.id, req.app.get('io'));
    res.json({ success: true, message: 'Campaign resumed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.cancelCampaign = async (req, res) => {
  try {
    await campaignService.cancelCampaign(req.params.id);
    res.json({ success: true, message: 'Campaign cancelled' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCampaignMessages = async (req, res) => {
  try {
    const Message = require('../models/Message');
    const messages = await Message.find({ campaignId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCampaignAnalytics = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    const campaigns = await Campaign.find(filter).sort({ createdAt: -1 });
    
    // If user is admin, hide sensitive campaign data for other users' campaigns
    if (req.user.role === 'admin') {
      const anonymizedCampaigns = campaigns.map(campaign => {
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
      
      const total = anonymizedCampaigns.length;
      const running = anonymizedCampaigns.filter(c => c.status === 'running').length;
      const completed = anonymizedCampaigns.filter(c => c.status === 'completed').length;
      const failed = anonymizedCampaigns.filter(c => c.status === 'failed').length;
      const totalSent = anonymizedCampaigns.reduce((s, c) => s + c.sentCount, 0);
      const totalDelivered = anonymizedCampaigns.reduce((s, c) => s + c.deliveredCount, 0);
      const totalFailed = anonymizedCampaigns.reduce((s, c) => s + c.failedCount, 0);

      res.json({
        success: true,
        analytics: {
          total,
          running,
          completed,
          failed,
          totalSent,
          totalDelivered,
          totalFailed,
          campaigns: anonymizedCampaigns
        }
      });
    } else {
      const total = campaigns.length;
      const running = campaigns.filter(c => c.status === 'running').length;
      const completed = campaigns.filter(c => c.status === 'completed').length;
      const failed = campaigns.filter(c => c.status === 'failed').length;
      const totalSent = campaigns.reduce((s, c) => s + c.sentCount, 0);
      const totalDelivered = campaigns.reduce((s, c) => s + c.deliveredCount, 0);
      const totalFailed = campaigns.reduce((s, c) => s + c.failedCount, 0);

      res.json({
        success: true,
        analytics: {
          total,
          running,
          completed,
          failed,
          totalSent,
          totalDelivered,
          totalFailed,
          campaigns
        }
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
