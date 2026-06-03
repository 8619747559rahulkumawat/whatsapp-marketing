const SmsCampaign = require('../models/SmsCampaign');

exports.getCampaigns = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    if (req.user.role !== 'admin') filter.userId = req.user._id;
    const campaigns = await SmsCampaign.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, campaigns });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCampaign = async (req, res) => {
  try {
    const campaign = await SmsCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createCampaign = async (req, res) => {
  try {
    const campaign = await SmsCampaign.create({
      ...req.body, tenantId: req.tenant._id, userId: req.user._id
    });
    res.status(201).json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCampaign = async (req, res) => {
  try {
    const campaign = await SmsCampaign.findByIdAndUpdate(
      req.params.id, { ...req.body, updatedAt: new Date() }, { new: true }
    );
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    await SmsCampaign.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.sendCampaign = async (req, res) => {
  try {
    const campaign = await SmsCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    campaign.status = 'sending';
    await campaign.save();
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    if (campaign.gateway === 'twilio' && accountSid && authToken) {
      const twilio = require('twilio');
      const client = twilio(accountSid, authToken);
      let sent = 0, failed = 0;
      for (const recipient of (campaign.recipients || [])) {
        try {
          await client.messages.create({
            body: campaign.message,
            from: twilioNumber,
            to: recipient.phone
          });
          sent++;
        } catch { failed++; }
      }
      campaign.stats = { sent, delivered: 0, failed };
    }
    campaign.status = 'sent';
    campaign.sentAt = new Date();
    await campaign.save();
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
