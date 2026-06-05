const SmsCampaign = require('../models/SmsCampaign');

const runningCampaigns = new Set();
const MAX_SMS_RECIPIENTS = parseInt(process.env.SMS_CAMPAIGN_MAX_RECIPIENTS || '5000', 10);
const SMS_SEND_DELAY_MS = parseInt(process.env.SMS_SEND_DELAY_MS || '150', 10);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeRecipients = (recipients = []) => {
  const seen = new Set();
  const normalized = [];

  for (const recipient of recipients) {
    const phone = String(recipient?.phone || '').trim().replace(/[^\d+]/g, '');
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    normalized.push({
      phone,
      name: String(recipient?.name || '').trim(),
      contactId: recipient?.contactId || undefined
    });
  }

  return normalized;
};

const getTwilioClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !from) {
    throw new Error('Twilio SMS credentials are not configured');
  }

  const twilio = require('twilio');
  return { client: twilio(accountSid, authToken), from };
};

const sendTwilioCampaign = async (campaignId) => {
  if (runningCampaigns.has(campaignId.toString())) return;
  runningCampaigns.add(campaignId.toString());

  try {
    const campaign = await SmsCampaign.findById(campaignId);
    if (!campaign) return;

    if (campaign.gateway !== 'twilio') {
      campaign.status = 'failed';
      campaign.error = `${campaign.gateway} gateway sending is not configured yet`;
      await campaign.save();
      return;
    }

    const { client, from } = getTwilioClient();
    let sent = campaign.stats?.sent || 0;
    let failed = campaign.stats?.failed || 0;
    const startIndex = sent + failed;

    campaign.status = 'sending';
    campaign.startedAt = campaign.startedAt || new Date();
    campaign.error = '';
    await campaign.save();

    for (let i = startIndex; i < (campaign.recipients || []).length; i++) {
      const latest = await SmsCampaign.findById(campaignId).select('status').lean();
      if (!latest || latest.status !== 'sending') return;

      const recipient = campaign.recipients[i];
      try {
        await client.messages.create({
          body: campaign.message,
          from,
          to: recipient.phone
        });
        sent++;
      } catch (err) {
        failed++;
        console.error(`[SMS Campaign] Failed for ${recipient.phone}: ${err.message}`);
      }

      await SmsCampaign.findByIdAndUpdate(campaignId, {
        stats: { sent, delivered: 0, failed },
        updatedAt: new Date()
      });

      if (SMS_SEND_DELAY_MS > 0 && i < campaign.recipients.length - 1) {
        await sleep(SMS_SEND_DELAY_MS);
      }
    }

    await SmsCampaign.findByIdAndUpdate(campaignId, {
      status: failed > 0 && sent === 0 ? 'failed' : 'sent',
      sentAt: new Date(),
      updatedAt: new Date()
    });
  } catch (err) {
    console.error('[SMS Campaign] Send error:', err.message);
    await SmsCampaign.findByIdAndUpdate(campaignId, {
      status: 'failed',
      error: err.message,
      updatedAt: new Date()
    });
  } finally {
    runningCampaigns.delete(campaignId.toString());
  }
};

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
    const recipients = normalizeRecipients(req.body.recipients);
    if (recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one valid recipient is required' });
    }
    if (recipients.length > MAX_SMS_RECIPIENTS) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_SMS_RECIPIENTS} recipients are allowed per SMS campaign`
      });
    }

    const campaign = await SmsCampaign.create({
      ...req.body,
      recipients,
      tenantId: req.tenant._id,
      userId: req.user._id,
      stats: { sent: 0, delivered: 0, failed: 0 }
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
    if (campaign.tenantId.toString() !== req.tenant._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (campaign.status === 'sending') {
      if (!runningCampaigns.has(campaign._id.toString())) {
        sendTwilioCampaign(campaign._id).catch((err) => console.error('[SMS Campaign] Background error:', err));
        return res.json({ success: true, message: 'SMS campaign resumed', campaign });
      }
      return res.json({ success: true, message: 'SMS campaign is already sending', campaign });
    }
    if ((campaign.recipients || []).length > MAX_SMS_RECIPIENTS) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_SMS_RECIPIENTS} recipients are allowed per SMS campaign`
      });
    }

    campaign.status = 'sending';
    campaign.stats = { sent: 0, delivered: 0, failed: 0 };
    campaign.error = '';
    await campaign.save();
    sendTwilioCampaign(campaign._id).catch((err) => console.error('[SMS Campaign] Background error:', err));

    res.json({
      success: true,
      message: `SMS campaign queued for ${(campaign.recipients || []).length} recipients`,
      campaign
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
