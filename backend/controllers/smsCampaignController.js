const SmsCampaign = require('../models/SmsCampaign');
const { getIoInstance } = require('../socket');

const runningCampaigns = new Set();
const MAX_SMS_RECIPIENTS = parseInt(process.env.SMS_CAMPAIGN_MAX_RECIPIENTS || '5000', 10);
const BATCH_SIZE = parseInt(process.env.SMS_BATCH_SIZE || '5', 10);
const BATCH_DELAY_MS = parseInt(process.env.SMS_BATCH_DELAY_MS || '6000', 10);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeRecipients = (recipients = []) => {
  const seen = new Set();
  const normalized = [];

  for (const recipient of recipients) {
    let phone = String(recipient?.phone || '').trim();
    if (!phone || seen.has(phone)) continue;
    if (phone.startsWith('+')) {
      // Already has +, validate length (digits only)
      const digits = phone.replace(/[^\d]/g, '');
      if (digits.length < 10 || digits.length > 15) continue;
      seen.add(phone);
      normalized.push({
        phone,
        name: String(recipient?.name || '').trim(),
        contactId: recipient?.contactId || undefined
      });
      continue;
    }
    phone = phone.replace(/[^\d]/g, '');
    if (!phone || seen.has(phone)) continue;
    if (phone.length === 10) phone = '91' + phone;
    if (phone.length < 10 || phone.length > 15) continue;
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

const emitProgress = (campaignId, data) => {
  try {
    const io = getIoInstance();
    if (io) io.to(`campaign_${campaignId}`).emit('sms:progress', { campaignId, ...data });
  } catch {}
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
    const total = (campaign.recipients || []).length;
    const startIndex = sent + failed;

    campaign.status = 'sending';
    campaign.startedAt = campaign.startedAt || new Date();
    campaign.error = '';
    await campaign.save();

    emitProgress(campaignId, { status: 'sending', sent, failed, total });

    for (let i = startIndex; i < total; i += BATCH_SIZE) {
      const latest = await SmsCampaign.findById(campaignId).select('status').lean();
      if (!latest || latest.status !== 'sending') return;

      const batch = (campaign.recipients || []).slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((recipient, idx) => {
          const toPhone = recipient.phone.startsWith('+') ? recipient.phone : `+${recipient.phone}`;
          return client.messages.create({ body: campaign.message, from, to: toPhone })
            .then(() => ({ phone: recipient.phone, idx: i + idx, ok: true }))
            .catch((err) => ({ phone: recipient.phone, idx: i + idx, ok: false, error: err.message }));
        })
      )

      const updateOps = {};
      for (const r of results) {
        const val = r.status === 'fulfilled' ? r.value : { phone: '?', idx: 0, ok: false, error: r.reason?.message || 'unknown' };
        if (val.ok) {
          sent++;
          updateOps[`recipients.${val.idx}.status`] = 'sent';
        } else {
          failed++;
          updateOps[`recipients.${val.idx}.status`] = 'failed';
          updateOps[`recipients.${val.idx}.error`] = val.error?.slice(0, 200) || 'Failed';
          console.error(`[SMS Campaign] Failed for ${val.phone}: ${val.error}`);
        }
      }

      const batchSent = results.filter(r => {
        const val = r.status === 'fulfilled' ? r.value : null;
        return val && val.ok;
      }).length;
      const batchFailed = results.length - batchSent;
      await SmsCampaign.findByIdAndUpdate(campaignId, {
        $inc: { 'stats.sent': batchSent, 'stats.failed': batchFailed },
        $set: { updatedAt: new Date(), ...updateOps }
      });

      emitProgress(campaignId, { sent, failed, total, processed: sent + failed });

      if (BATCH_DELAY_MS > 0 && i + BATCH_SIZE < total) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    const finalStatus = failed > 0 && sent === 0 ? 'failed' : 'sent';
    await SmsCampaign.findByIdAndUpdate(campaignId, {
      status: finalStatus,
      sentAt: new Date(),
      updatedAt: new Date()
    });

    emitProgress(campaignId, { status: finalStatus, sent, failed, total });
  } catch (err) {
    console.error('[SMS Campaign] Send error:', err.message);
    await SmsCampaign.findByIdAndUpdate(campaignId, {
      status: 'failed',
      error: err.message,
      updatedAt: new Date()
    });
    emitProgress(campaignId, { status: 'failed', error: err.message });
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
    const filter = { _id: req.params.id, tenantId: req.tenant._id };
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      filter.userId = req.user._id;
    }
    const campaign = await SmsCampaign.findOne(filter);
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
    const allowedFields = ['name', 'message', 'recipients', 'gateway', 'status'];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updatedAt = new Date();
    const filter = { _id: req.params.id, tenantId: req.tenant._id };
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      filter.userId = req.user._id;
    }
    const campaign = await SmsCampaign.findOneAndUpdate(filter, updates, { new: true });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const filter = { _id: req.params.id, tenantId: req.tenant._id };
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      filter.userId = req.user._id;
    }
    const campaign = await SmsCampaign.findOneAndDelete(filter);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.sendCampaign = async (req, res) => {
  try {
    const campaign = await SmsCampaign.findOne({ _id: req.params.id, tenantId: req.tenant._id });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
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

    const isNew = campaign.status === 'draft';
    campaign.status = 'sending';
    if (isNew) {
      campaign.stats = { sent: 0, delivered: 0, failed: 0 };
    }
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
