const crypto = require('crypto');
const fetch = require('node-fetch');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const { formatPhoneNumber } = require('../utils/helpers');

const jobs = new Map();
const JOB_TTL_MS = 24 * 60 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getCloudConfig = () => {
  const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || 'v20.0';

  if (!accessToken || !phoneNumberId) {
    throw new Error('WhatsApp Cloud API is not configured. Set WHATSAPP_CLOUD_ACCESS_TOKEN and WHATSAPP_CLOUD_PHONE_NUMBER_ID in backend/.env');
  }

  return { accessToken, phoneNumberId, apiVersion };
};

const normalizeContacts = (contacts = []) => {
  const seen = new Set();
  const normalized = [];
  const duplicates = [];
  const invalid = [];

  for (const item of contacts) {
    const rawPhone = typeof item === 'string' ? item : item?.phone;
    const phone = formatPhoneNumber(String(rawPhone || ''));

    if (!/^\d{10,15}$/.test(phone)) {
      invalid.push(rawPhone || '');
      continue;
    }

    if (seen.has(phone)) {
      duplicates.push(phone);
      continue;
    }

    seen.add(phone);
    normalized.push({
      phone,
      name: typeof item === 'object' ? item.name || '' : '',
      variables: typeof item === 'object' ? item.variables || {} : {}
    });
  }

  return { normalized, duplicates, invalid };
};

const buildTemplatePayload = ({ to, templateName, languageCode, components }) => ({
  messaging_product: 'whatsapp',
  to,
  type: 'template',
  template: {
    name: templateName,
    language: { code: languageCode || 'en_US' },
    ...(Array.isArray(components) && components.length > 0 ? { components } : {})
  }
});

const sendTemplateMessage = async ({ to, templateName, languageCode, components }) => {
  const { accessToken, phoneNumberId, apiVersion } = getCloudConfig();
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildTemplatePayload({ to, templateName, languageCode, components }))
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = data?.error?.message || `WhatsApp Cloud API request failed with HTTP ${response.status}`;
    const error = new Error(errorMessage);
    error.meta = data;
    error.status = response.status;
    throw error;
  }

  return data;
};

const createMessageRecord = async ({ user, tenantId, phone, templateName, status, waMessageId = '', statusReason = '' }) => {
  return Message.create({
    userId: user._id,
    tenantId,
    sessionId: 'cloud_api',
    to: phone,
    messageType: 'text',
    content: `template:${templateName}`,
    status,
    waMessageId,
    statusReason,
    sentAt: status === 'sent' ? new Date() : undefined
  });
};

const updateJob = (jobId, patch) => {
  const job = jobs.get(jobId);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  return job;
};

const runTemplateBatchJob = async (jobId, options) => {
  const {
    user,
    tenantId,
    contacts,
    templateName,
    languageCode,
    components,
    batchSize,
    batchDelayMs,
    dailyLimit
  } = options;

  updateJob(jobId, { status: 'running', startedAt: new Date().toISOString() });

  const targetContacts = contacts.slice(0, dailyLimit);
  if (contacts.length > dailyLimit) {
    updateJob(jobId, { capped: true, capReason: `Limited to dailyLimit=${dailyLimit}` });
  }

  for (let i = 0; i < targetContacts.length; i += batchSize) {
    const job = jobs.get(jobId);
    if (!job || job.status === 'cancelled') return;

    const batch = targetContacts.slice(i, i + batchSize);
    updateJob(jobId, {
      currentBatch: Math.floor(i / batchSize) + 1,
      totalBatches: Math.ceil(targetContacts.length / batchSize)
    });

    for (const contact of batch) {
      const currentJob = jobs.get(jobId);
      if (!currentJob || currentJob.status === 'cancelled') return;

      try {
        const savedContact = await Contact.findOne({ tenantId, phone: contact.phone }).select('isBlacklisted blacklistReason').lean();
        if (savedContact?.isBlacklisted) {
          await createMessageRecord({
            user,
            tenantId,
            phone: contact.phone,
            templateName,
            status: 'failed',
            statusReason: savedContact.blacklistReason || 'Contact is blacklisted'
          });
          currentJob.failed += 1;
          currentJob.results.push({ phone: contact.phone, status: 'skipped', error: 'Contact is blacklisted' });
          currentJob.processed += 1;
          updateJob(jobId, {});
          continue;
        }

        const response = await sendTemplateMessage({
          to: contact.phone,
          templateName,
          languageCode,
          components
        });
        const waMessageId = response?.messages?.[0]?.id || '';
        const record = await createMessageRecord({
          user,
          tenantId,
          phone: contact.phone,
          templateName,
          status: 'sent',
          waMessageId
        });

        currentJob.sent += 1;
        currentJob.processed += 1;
        currentJob.results.push({ phone: contact.phone, status: 'sent', messageId: record._id, waMessageId });
        updateJob(jobId, {});
      } catch (err) {
        await createMessageRecord({
          user,
          tenantId,
          phone: contact.phone,
          templateName,
          status: 'failed',
          statusReason: err.message
        });

        currentJob.failed += 1;
        currentJob.processed += 1;
        currentJob.results.push({
          phone: contact.phone,
          status: 'failed',
          error: err.message,
          meta: err.meta?.error ? err.meta.error : undefined
        });
        updateJob(jobId, {});
      }
    }

    if (i + batchSize < targetContacts.length) {
      updateJob(jobId, {
        nextBatchAt: new Date(Date.now() + batchDelayMs).toISOString()
      });
      await sleep(batchDelayMs);
    }
  }

  updateJob(jobId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    nextBatchAt: null
  });
};

const startTemplateBatch = ({ user, tenantId, contacts, templateName, languageCode, components, batchSize, batchDelayMs, dailyLimit }) => {
  const { normalized, duplicates, invalid } = normalizeContacts(contacts);
  if (normalized.length === 0) throw new Error('No valid contacts found');

  const jobId = `cloud_${crypto.randomBytes(12).toString('hex')}`;
  const safeBatchSize = Math.min(250, Math.max(1, parseInt(batchSize || 100, 10)));
  const safeBatchDelayMs = Math.max(30000, parseInt(batchDelayMs || 120000, 10));
  const safeDailyLimit = Math.min(100000, Math.max(1, parseInt(dailyLimit || normalized.length, 10)));

  const job = {
    id: jobId,
    status: 'queued',
    templateName,
    languageCode: languageCode || 'en_US',
    total: Math.min(normalized.length, safeDailyLimit),
    originalTotal: contacts.length,
    processed: 0,
    sent: 0,
    failed: 0,
    duplicates: duplicates.length,
    invalid: invalid.length,
    capped: normalized.length > safeDailyLimit,
    batchSize: safeBatchSize,
    batchDelayMs: safeBatchDelayMs,
    dailyLimit: safeDailyLimit,
    currentBatch: 0,
    totalBatches: Math.ceil(Math.min(normalized.length, safeDailyLimit) / safeBatchSize),
    results: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    nextBatchAt: null
  };

  jobs.set(jobId, job);
  setTimeout(() => jobs.delete(jobId), JOB_TTL_MS).unref?.();

  setImmediate(() => {
    runTemplateBatchJob(jobId, {
      user,
      tenantId,
      contacts: normalized,
      templateName,
      languageCode,
      components,
      batchSize: safeBatchSize,
      batchDelayMs: safeBatchDelayMs,
      dailyLimit: safeDailyLimit
    }).catch((err) => {
      updateJob(jobId, {
        status: 'failed',
        error: err.message,
        completedAt: new Date().toISOString()
      });
    });
  });

  return job;
};

const getJob = (jobId) => jobs.get(jobId) || null;

const cancelJob = (jobId) => {
  const job = jobs.get(jobId);
  if (!job) return null;
  if (job.status === 'completed' || job.status === 'failed') return job;
  return updateJob(jobId, { status: 'cancelled', completedAt: new Date().toISOString() });
};

module.exports = {
  startTemplateBatch,
  getJob,
  cancelJob,
  sendTemplateMessage
};
