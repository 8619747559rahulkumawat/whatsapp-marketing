const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const Message = require('../models/Message');
const Session = require('../models/Session');
const Compliance = require('../models/Compliance');
const whatsappService = require('./whatsappService');
const automationService = require('./automationService');
const intentService = require('./intentService');
const { formatPhoneNumber } = require('../utils/helpers');

const runningCampaigns = new Map();
const DEFAULT_MIN_DELAY_SECONDS = parseInt(process.env.CAMPAIGN_MIN_DELAY_SECONDS || '20', 10);
const DEFAULT_MAX_DELAY_SECONDS = parseInt(process.env.CAMPAIGN_MAX_DELAY_SECONDS || '45', 10);
const DEFAULT_DAILY_LIMIT = parseInt(process.env.CAMPAIGN_DAILY_LIMIT || '200', 10);
const HIGH_FAILURE_RATE_THRESHOLD = 0.3;
const HIGH_FAILURE_RATE_MIN_ATTEMPTS = 20;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getDelayWindow = (campaign) => {
  const min = Math.max(5, parseInt(campaign.minDelaySeconds || DEFAULT_MIN_DELAY_SECONDS, 10));
  const max = Math.max(min, parseInt(campaign.maxDelaySeconds || DEFAULT_MAX_DELAY_SECONDS, 10));
  return { min, max };
};

const controlledDelay = async (campaign) => {
  const { min, max } = getDelayWindow(campaign);
  const seconds = Math.floor(Math.random() * (max - min + 1) + min);
  console.log(`[CampaignSafety] Waiting ${seconds}s before next eligible message...`);
  await sleep(seconds * 1000);
};

const shouldPauseForFailureRate = (campaign, sentCount, failedCount) => {
  if (campaign.stopOnHighFailureRate === false) return false;
  const attempts = sentCount + failedCount;
  return attempts >= HIGH_FAILURE_RATE_MIN_ATTEMPTS && failedCount / attempts >= HIGH_FAILURE_RATE_THRESHOLD;
};

const appendOptOutInstruction = (campaign, message) => {
  if (campaign.appendOptOut === false) return message;
  if (/\b(stop|unsubscribe|opt[-\s]?out)\b/i.test(message)) return message;
  return `${message}\n\nReply STOP to unsubscribe.`;
};

const withSafetyNote = (campaign, note, updates = {}) => {
  const current = campaign.safetySummary?.toObject
    ? campaign.safetySummary.toObject()
    : { ...(campaign.safetySummary || {}) };
  return {
    ...current,
    ...updates,
    notes: [...(current.notes || []), note]
  };
};

const personalizeMessage = (campaign, contact, phone) => {
  let message = campaign.message || '';
  if (campaign.isPersonalized) {
    message = message.replace(/{name}/g, contact.name || '')
      .replace(/{phone}/g, phone)
      .replace(/{email}/g, contact.email || '');
  }
  return appendOptOutInstruction(campaign, message);
};

const getLatestConsentByPhone = async (tenantId, phones) => {
  if (!phones.length) return new Map();
  const logs = await Compliance.find({
    tenantId,
    phone: { $in: phones },
    type: { $in: ['opt_in', 'opt_out', 'consent_given', 'consent_withdrawn'] }
  }).sort({ timestamp: -1 }).lean();

  const latest = new Map();
  for (const log of logs) {
    if (!latest.has(log.phone)) latest.set(log.phone, log);
  }
  return latest;
};

const prepareCampaignAudience = async (campaign, contacts) => {
  const summary = {
    duplicates: 0,
    blacklisted: 0,
    optedOut: 0,
    missingOptIn: 0,
    alreadySent: 0,
    invalidPhone: 0,
    capped: false,
    notes: []
  };
  const seen = new Set();
  const eligible = [];
  const candidates = [];

  const sentMessages = await Message.find({
    campaignId: campaign._id,
    status: { $in: ['sent', 'delivered', 'read'] }
  }).select('to').lean();
  const alreadySentPhones = new Set(sentMessages.map(m => formatPhoneNumber(m.to)));

  for (const contact of contacts) {
    const rawPhone = contact?.phone || contact;
    const phone = formatPhoneNumber(String(rawPhone || ''));
    if (!phone || phone.length < 10) {
      summary.invalidPhone++;
      continue;
    }
    if (seen.has(phone)) {
      summary.duplicates++;
      continue;
    }
    seen.add(phone);
    if (alreadySentPhones.has(phone)) {
      summary.alreadySent++;
      continue;
    }
    if (contact?.isBlacklisted) {
      summary.blacklisted++;
      continue;
    }
    candidates.push({ contact, phone });
  }

  const latestConsent = await getLatestConsentByPhone(campaign.tenantId, candidates.map(c => c.phone));
  for (const candidate of candidates) {
    const consent = latestConsent.get(candidate.phone);
    if (consent?.type === 'opt_out' || consent?.type === 'consent_withdrawn') {
      summary.optedOut++;
      continue;
    }
    if (campaign.requireOptIn !== false && consent?.type !== 'opt_in' && consent?.type !== 'consent_given') {
      summary.missingOptIn++;
      continue;
    }
    eligible.push(candidate);
  }

  if (campaign.requireOptIn !== false) {
    summary.notes.push('Only contacts with opt-in/consent logs are eligible.');
  }
  summary.notes.push('Duplicates, blacklisted contacts, opted-out contacts, and already-sent contacts are skipped.');

  return {
    eligible,
    summary,
    existingSentCount: alreadySentPhones.size,
    skippedCount: Object.entries(summary)
      .filter(([, value]) => typeof value === 'number')
      .reduce((total, [, value]) => total + value, 0)
  };
};

const getRemainingDailySlots = async (campaign, session) => {
  const dailyLimit = Math.max(1, parseInt(campaign.dailyLimit || DEFAULT_DAILY_LIMIT, 10));
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sentInWindow = await Message.countDocuments({
    userId: campaign.userId,
    sessionId: session.sessionId,
    sentAt: { $gte: since },
    status: { $in: ['sent', 'delivered', 'read'] }
  });
  return Math.max(0, dailyLimit - sentInWindow);
};

const checkCampaignStillRunning = async (campaignId) => {
  if (!runningCampaigns.has(campaignId.toString())) return 'paused';
  const latest = await Campaign.findById(campaignId).select('status').lean();
  if (!latest || latest.status === 'cancelled') return 'cancelled';
  if (latest.status === 'paused') return 'paused';
  return 'running';
};

const processCampaign = async (campaignId, io) => {
  const campaignKey = campaignId.toString();
  if (runningCampaigns.has(campaignKey)) {
    console.log(`Campaign ${campaignId} already running`);
    return;
  }

  const campaign = await Campaign.findById(campaignId).populate('contacts').populate('sessionId');
  if (!campaign) throw new Error('Campaign not found');

  if (campaign.status === 'cancelled') return;

  runningCampaigns.set(campaignKey, true);
  campaign.status = 'running';
  if (!campaign.startedAt) campaign.startedAt = new Date();
  await campaign.save();

  try {
    let contacts = [];
    if (campaign.contacts && campaign.contacts.length > 0) {
      contacts = campaign.contacts;
    }
    if (campaign.groups && campaign.groups.length > 0) {
      const groupContacts = await Contact.find({ groups: { $in: campaign.groups } });
      const existingIds = new Set(contacts.map(c => c._id.toString()));
      for (const c of groupContacts) {
        if (!existingIds.has(c._id.toString())) contacts.push(c);
      }
    }

    let result;
    if (campaign.type === 'bulk') {
      result = await sendBulkMessages(campaign, contacts, io);
    } else if (campaign.type === 'dp') {
      result = await sendDpMessages(campaign, contacts, io);
    } else {
      result = await sendBulkMessages(campaign, contacts, io);
    }

    if (result?.status === 'paused' || result?.status === 'cancelled') {
      campaign.status = result.status;
      await campaign.save();
      if (io) {
        io.to(`campaign_${campaignId}`).emit(`campaign:${result.status}`, {
          campaignId,
          reason: result.reason || ''
        });
      }
      return;
    }

    campaign.status = 'completed';
    campaign.completedAt = new Date();
    await campaign.save();

    await automationService.triggerAutomation('campaign_completed', {
      campaignId: campaign._id, userId: campaign.userId,
      tenantId: campaign.tenantId, sent: campaign.sentCount
    }, io);

    if (io) {
      io.to(`campaign_${campaignId}`).emit('campaign:completed', { campaignId });
    }
  } catch (err) {
    campaign.status = 'failed';
    await campaign.save();
    if (io) {
      io.to(`campaign_${campaignId}`).emit('campaign:failed', { campaignId, error: err.message });
    }
    throw err;
  } finally {
    runningCampaigns.delete(campaignKey);
  }
};

const sendBulkMessages = async (campaign, contacts, io) => {
  const session = campaign.sessionId || (await Session.findById(campaign.sessionId));
  if (!session) throw new Error('WhatsApp session not found');

  const audience = await prepareCampaignAudience(campaign, contacts);
  const total = audience.eligible.length + audience.existingSentCount;
  let sentCount = audience.existingSentCount;
  let failedCount = campaign.failedCount || 0;
  let sentThisRun = 0;
  let remainingDailySlots = await getRemainingDailySlots(campaign, session);

  campaign.totalContacts = total;
  campaign.pendingCount = audience.eligible.length;
  campaign.sentCount = sentCount;
  campaign.failedCount = failedCount;
  campaign.skippedCount = audience.skippedCount;
  campaign.safetySummary = audience.summary;
  await campaign.save();

  if (remainingDailySlots <= 0 && audience.eligible.length > 0) {
    campaign.status = 'paused';
    campaign.safetySummary = withSafetyNote(
      campaign,
      'Daily campaign safety limit reached. Resume after the 24-hour window clears.',
      { capped: true }
    );
    await campaign.save();
    return { status: 'paused', reason: 'daily_limit_reached' };
  }

  for (let i = 0; i < audience.eligible.length; i++) {
    const state = await checkCampaignStillRunning(campaign._id);
    if (state !== 'running') return { status: state, reason: 'user_action' };

    if (sentThisRun >= remainingDailySlots) {
      campaign.status = 'paused';
      campaign.pendingCount = audience.eligible.length - i;
      campaign.safetySummary = withSafetyNote(
        campaign,
        'Daily campaign safety limit reached. Resume after the 24-hour window clears.',
        { capped: true }
      );
      await campaign.save();
      return { status: 'paused', reason: 'daily_limit_reached' };
    }

    const { contact, phone } = audience.eligible[i];
    try {
      const message = personalizeMessage(campaign, contact, phone);

      console.log(`[Campaign] Sending to ${phone} (${i + 1}/${total})`);

      let result;
      if (campaign.buttons && campaign.buttons.length > 0) {
        result = await whatsappService.sendButtonMessage(session.sessionId, phone, message, campaign.buttons);
      } else if (campaign.mediaUrl && campaign.messageType !== 'text') {
        result = await whatsappService.sendMediaMessage(session.sessionId, phone, campaign.mediaUrl, campaign.messageType, message);
      } else {
        result = await whatsappService.sendTextMessage(session.sessionId, phone, message);
      }

      await Message.create({
        userId: campaign.userId, tenantId: campaign.tenantId,
        campaignId: campaign._id, sessionId: session.sessionId,
        contactId: contact._id, to: phone,
        messageType: campaign.messageType, content: message,
        mediaUrl: campaign.mediaUrl || '',
        status: result?.id ? 'sent' : 'failed',
        waMessageId: result?.id || '',
        sentAt: new Date()
      });

      const contactId = contact._id;
      if (contactId) {
        await Contact.findByIdAndUpdate(contactId, {
          lastMessaged: new Date(),
          $inc: { messageCount: 1 }
        });
      }

      sentCount++;
      sentThisRun++;
      campaign.sentCount = sentCount;
      campaign.pendingCount = Math.max(0, audience.eligible.length - i - 1);
      await campaign.save();

      if (io) {
        io.to(`campaign_${campaign._id}`).emit('campaign:progress', {
          campaignId: campaign._id, sent: sentCount, failed: failedCount,
          skipped: campaign.skippedCount, total, pending: campaign.pendingCount
        });
      }

      if (i < audience.eligible.length - 1) {
        await controlledDelay(campaign);
      }
    } catch (err) {
      console.error(`[Campaign] Failed for ${contact.phone || contact}: ${err.message}`);
      failedCount++;
      campaign.failedCount = failedCount;
      campaign.pendingCount = Math.max(0, audience.eligible.length - i - 1);
      await campaign.save();

      await Message.create({
        userId: campaign.userId, tenantId: campaign.tenantId,
        campaignId: campaign._id, sessionId: session.sessionId,
        to: contact.phone || contact, messageType: campaign.messageType,
        content: campaign.message, status: 'failed',
        statusReason: err.message, sentAt: new Date()
      });

      if (shouldPauseForFailureRate(campaign, sentCount, failedCount)) {
        campaign.status = 'paused';
        campaign.safetySummary = withSafetyNote(
          campaign,
          'Paused because the failure rate crossed the safety threshold. Review the contact list and session health before resuming.'
        );
        await campaign.save();
        return { status: 'paused', reason: 'high_failure_rate' };
      }

      if (i < audience.eligible.length - 1) {
        await controlledDelay(campaign);
      }
    }
  }
  return { status: 'completed' };
};

const sendDpMessages = async (campaign, contacts, io) => {
  return sendBulkMessages(campaign, contacts, io);
};

const pauseCampaign = async (campaignId) => {
  const campaign = await Campaign.findByIdAndUpdate(campaignId, { status: 'paused' });
  if (campaign) runningCampaigns.delete(campaignId.toString());
  return campaign;
};

const resumeCampaign = async (campaignId, io) => {
  const campaign = await Campaign.findById(campaignId);
  if (campaign && campaign.status === 'paused') {
    processCampaign(campaignId, io).catch(err => console.error('Resume error:', err));
  }
  return campaign;
};

const cancelCampaign = async (campaignId) => {
  runningCampaigns.delete(campaignId.toString());
  return Campaign.findByIdAndUpdate(campaignId, { status: 'cancelled' });
};

const getCampaignStatus = async (campaignId) => {
  const campaign = await Campaign.findById(campaignId).select('status sentCount deliveredCount failedCount pendingCount skippedCount totalContacts safetySummary');
  return campaign;
};

module.exports = {
  processCampaign, pauseCampaign, resumeCampaign, cancelCampaign, getCampaignStatus
};
