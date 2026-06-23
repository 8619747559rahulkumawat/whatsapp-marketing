const axios = require('axios');
const SmsFallbackLog = require('../models/SmsFallbackLog');

const sendViaTwilio = async (to, message) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    throw new Error('Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env');
  }

  const toPhone = to.startsWith('+') ? to : `+${to}`;

  const response = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    new URLSearchParams({ To: toPhone, From: from, Body: message }),
    { auth: { username: accountSid, password: authToken }, timeout: 15000 }
  );

  return {
    sid: response.data.sid,
    status: response.data.status,
    price: response.data.price || 0
  };
};

const sendViaLocalGateway = async (to, message, gatewayUrl) => {
  const url = gatewayUrl || process.env.LOCAL_SMS_GATEWAY_URL;
  if (!url) throw new Error('Local SMS gateway URL not configured');

  const response = await axios.post(url, {
    to, message,
    apiKey: process.env.LOCAL_SMS_API_KEY || ''
  }, { timeout: 10000 });

  return {
    sid: response.data?.messageId || `local_${Date.now()}`,
    status: response.data?.status || 'sent',
    price: 0
  };
};

const executeSmsFallback = async (messageDoc, tenantId, userId) => {
  const channel = process.env.SMS_PROVIDER || 'twilio';
  const phone = messageDoc.to;
  const content = messageDoc.content || messageDoc.message;

  let log = await SmsFallbackLog.create({
    tenantId, userId,
    messageId: messageDoc._id,
    phone, content,
    channel: channel === 'twilio' ? 'twilio' : 'local_sms',
    waStatus: 'failed',
    smsStatus: 'pending',
    smsProvider: channel
  });

  const maxRetries = parseInt(process.env.SMS_MAX_RETRIES) || 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let result;
      if (channel === 'twilio') {
        result = await sendViaTwilio(phone, content);
      } else {
        result = await sendViaLocalGateway(phone, content);
      }

      log.smsStatus = 'sent';
      log.smsMessageId = result.sid;
      log.cost = result.price;
      log.sentAt = new Date();
      log.retryCount = attempt;
      await log.save();

      return { success: true, log, provider: channel, sid: result.sid };
    } catch (err) {
      lastError = err;
      log.retryCount = attempt;
      log.errorMessage = err.message;
      await log.save();

      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 5000));
      }
    }
  }

  log.smsStatus = 'failed';
  log.errorMessage = lastError?.message || 'Max retries exceeded';
  await log.save();

  return { success: false, log, error: lastError?.message };
};

const checkWhatsAppStatusAndFallback = async (messageDoc, tenantId, userId) => {
  const timeout = parseInt(process.env.WA_FALLBACK_TIMEOUT) || 60000;
  const startTime = Date.now();
  let checked = false;

  while (Date.now() - startTime < timeout) {
    const updated = await require('../models/Message').findById(messageDoc._id).lean();
    if (!updated) break;
    if (updated.status === 'delivered' || updated.status === 'read') {
      return { success: true, waStatus: updated.status, fallbackTriggered: false };
    }
    if (updated.status === 'failed') {
      return executeSmsFallback(messageDoc, tenantId, userId);
    }
    if (!checked && Date.now() - startTime > 30000) {
      checked = true;
      if (updated.status === 'sent' || updated.status === 'queued') {
        return executeSmsFallback(messageDoc, tenantId, userId);
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  const finalCheck = await require('../models/Message').findById(messageDoc._id).lean();
  if (!finalCheck || finalCheck.status === 'failed' || finalCheck.status === 'queued') {
    return executeSmsFallback(messageDoc, tenantId, userId);
  }

  return { success: true, waStatus: finalCheck.status, fallbackTriggered: false };
};

module.exports = { sendViaTwilio, sendViaLocalGateway, executeSmsFallback, checkWhatsAppStatusAndFallback };
