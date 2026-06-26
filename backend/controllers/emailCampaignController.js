const EmailCampaign = require('../models/EmailCampaign');
const Activity = require('../models/Activity');

exports.getCampaigns = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    if (req.user.role !== 'admin') filter.userId = req.user._id;
    const campaigns = await EmailCampaign.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, campaigns });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCampaign = async (req, res) => {
  try {
    const campaign = await EmailCampaign.findOne({ _id: req.params.id, tenantId: req.tenant._id });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createCampaign = async (req, res) => {
  try {
    const allowed = ['name', 'subject', 'body', 'recipients'];
    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    data.tenantId = req.tenant._id;
    data.userId = req.user._id;
    const campaign = await EmailCampaign.create(data);
    res.status(201).json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCampaign = async (req, res) => {
  try {
    const allowed = ['name', 'subject', 'body', 'recipients', 'status'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updatedAt = new Date();
    const campaign = await EmailCampaign.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id }, updates, { new: true }
    );
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    await EmailCampaign.findOneAndDelete({ _id: req.params.id, tenantId: req.tenant._id });
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.sendCampaign = async (req, res) => {
  try {
    const campaign = await EmailCampaign.findOne({ _id: req.params.id, tenantId: req.tenant._id });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    campaign.status = 'sending';
    await campaign.save();
    let sgMail;
    try {
      sgMail = require('@sendgrid/mail');
    } catch {
      campaign.status = 'failed';
      await campaign.save();
      return res.status(500).json({ success: false, message: 'SendGrid not installed' });
    }
    const Setting = require('../models/Setting');
    const settings = await Setting.findOne({ tenantId: req.tenant._id, key: 'sendgrid' });
    const apiKey = settings?.value?.apiKey || process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      campaign.status = 'failed'; await campaign.save();
      return res.status(400).json({ success: false, message: 'SendGrid API key not configured' });
    }
    sgMail.setApiKey(apiKey);
    const fromEmail = settings?.value?.fromEmail || process.env.SENDGRID_FROM_EMAIL || 'noreply@rsendix.pro';
    const fromName = settings?.value?.fromName || 'RSendix CRM';
    let sent = 0, bounced = 0;
    for (const recipient of (campaign.recipients || [])) {
      try {
        await sgMail.send({
          to: recipient.email,
          from: { email: fromEmail, name: fromName },
          subject: campaign.subject,
          html: campaign.body.replace(/\n/g, '<br/>'),
          trackingSettings: {
            clickTracking: { enable: true },
            openTracking: { enable: true }
          }
        });
        sent++;
      } catch { bounced++; }
    }
    campaign.stats = { sent, opened: 0, clicked: 0, bounced };
    campaign.status = sent > 0 ? 'sent' : 'failed';
    campaign.sentAt = new Date();
    await campaign.save();
    await Activity.create({
      tenantId: req.tenant._id, userId: req.user._id, type: 'email',
      title: `Email campaign sent: ${campaign.name}`,
      description: `${sent} sent, ${bounced} bounced`,
      metadata: { campaignId: campaign._id, sent, bounced }
    });
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.trackOpen = async (req, res) => {
  try {
    const { id } = req.params;
    await EmailCampaign.findByIdAndUpdate(id, { $inc: { 'stats.opened': 1 } });
    res.setHeader('Content-Type', 'image/gif');
    res.send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
  } catch { res.sendStatus(204); }
};

exports.trackClick = async (req, res) => {
  try {
    const { id } = req.params;
    await EmailCampaign.findByIdAndUpdate(id, { $inc: { 'stats.clicked': 1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
