const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const Message = require('../models/Message');
const Session = require('../models/Session');
const whatsappService = require('./whatsappService');
const automationService = require('./automationService');
const intentService = require('./intentService');
const { formatPhoneNumber } = require('../utils/helpers');
const { messageQueue } = require('./queueService');

const runningCampaigns = new Map();
const CAMPAIGN_MESSAGE_DELAY_MIN = 15;  // seconds
const CAMPAIGN_MESSAGE_DELAY_MAX = 30;  // seconds

const processCampaign = async (campaignId, io) => {
  if (runningCampaigns.has(campaignId)) {
    console.log(`Campaign ${campaignId} already running`);
    return;
  }

  const campaign = await Campaign.findById(campaignId).populate('contacts').populate('sessionId');
  if (!campaign) throw new Error('Campaign not found');

  if (campaign.status === 'cancelled') return;

  runningCampaigns.set(campaignId, true);
  campaign.status = 'running';
  campaign.startedAt = new Date();
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

    if (campaign.type === 'bulk') {
      await sendBulkMessages(campaign, contacts, io);
    } else if (campaign.type === 'dp') {
      await sendDpMessages(campaign, contacts, io);
    } else {
      await sendBulkMessages(campaign, contacts, io);
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
    runningCampaigns.delete(campaignId);
  }
};

const sendBulkMessages = async (campaign, contacts, io) => {
  const session = campaign.sessionId || (await Session.findById(campaign.sessionId));
  if (!session) throw new Error('WhatsApp session not found');

  let sentCount = 0, failedCount = 0;
  const total = contacts.length;

  campaign.totalContacts = total;
  campaign.pendingCount = total;
  campaign.sentCount = 0;
  campaign.failedCount = 0;
  await campaign.save();

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    try {
      const phone = formatPhoneNumber(contact.phone || contact);
      let message = campaign.message;
      if (campaign.isPersonalized) {
        message = message.replace(/{name}/g, contact.name || '')
          .replace(/{phone}/g, phone)
          .replace(/{email}/g, contact.email || '');
      }

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
      campaign.sentCount = sentCount;
      campaign.pendingCount = total - sentCount - failedCount;
      await campaign.save();

      if (io) {
        io.to(`campaign_${campaign._id}`).emit('campaign:progress', {
          campaignId: campaign._id, sent: sentCount, failed: failedCount,
          total, pending: campaign.pendingCount
        });
      }

      // Anti-ban: random delay between messages (15-30s)
      if (i < contacts.length - 1) {
        await whatsappService.randomDelay(CAMPAIGN_MESSAGE_DELAY_MIN, CAMPAIGN_MESSAGE_DELAY_MAX);
      }
    } catch (err) {
      console.error(`[Campaign] Failed for ${contact.phone || contact}: ${err.message}`);
      failedCount++;
      campaign.failedCount = failedCount;
      campaign.pendingCount = total - sentCount - failedCount;
      await campaign.save();

      await Message.create({
        userId: campaign.userId, tenantId: campaign.tenantId,
        campaignId: campaign._id, sessionId: session.sessionId,
        to: contact.phone || contact, messageType: campaign.messageType,
        content: campaign.message, status: 'failed',
        statusReason: err.message, sentAt: new Date()
      });

      // Still wait before next attempt
      if (i < contacts.length - 1) {
        await whatsappService.randomDelay(CAMPAIGN_MESSAGE_DELAY_MIN, CAMPAIGN_MESSAGE_DELAY_MAX);
      }
    }
  }
};

const sendDpMessages = async (campaign, contacts, io) => {
  if (!contacts.length) return;
  const session = campaign.sessionId || (await Session.findById(campaign.sessionId));
  if (!session) throw new Error('WhatsApp session not found');

  let sentCount = 0, failedCount = 0;
  campaign.totalContacts = contacts.length;
  await campaign.save();

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    try {
      const phone = formatPhoneNumber(contact.phone || contact);
      const message = campaign.isPersonalized
        ? campaign.message.replace(/{name}/g, contact.name || '').replace(/{phone}/g, phone)
        : campaign.message;

      console.log(`[DP Campaign] Sending to ${phone} (${i + 1}/${contacts.length})`);
      await whatsappService.sendTextMessage(session.sessionId, phone, message);
      sentCount++;
      campaign.sentCount = sentCount;
      await campaign.save();

      if (i < contacts.length - 1) {
        await whatsappService.randomDelay(CAMPAIGN_MESSAGE_DELAY_MIN, CAMPAIGN_MESSAGE_DELAY_MAX);
      }
    } catch (err) {
      console.error(`[DP Campaign] Failed for ${contact.phone || contact}: ${err.message}`);
      failedCount++;
      campaign.failedCount = failedCount;
      await campaign.save();
      if (i < contacts.length - 1) {
        await whatsappService.randomDelay(CAMPAIGN_MESSAGE_DELAY_MIN, CAMPAIGN_MESSAGE_DELAY_MAX);
      }
    }

    if (io && (sentCount + failedCount) % 10 === 0) {
      io.to(`campaign_${campaign._id}`).emit('campaign:progress', {
        campaignId: campaign._id, sent: sentCount, failed: failedCount,
        total: contacts.length
      });
    }
  }
};

const pauseCampaign = async (campaignId) => {
  const campaign = await Campaign.findByIdAndUpdate(campaignId, { status: 'paused' });
  if (campaign) runningCampaigns.delete(campaignId);
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
  runningCampaigns.delete(campaignId);
  return Campaign.findByIdAndUpdate(campaignId, { status: 'cancelled' });
};

const getCampaignStatus = async (campaignId) => {
  const campaign = await Campaign.findById(campaignId).select('status sentCount deliveredCount failedCount pendingCount totalContacts');
  return campaign;
};

module.exports = {
  processCampaign, pauseCampaign, resumeCampaign, cancelCampaign, getCampaignStatus
};
