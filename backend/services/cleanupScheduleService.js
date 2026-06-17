const cron = require('node-cron');

const SCHEDULE = process.env.CLEANUP_SCHEDULE || '0 3 * * *';
const CLEANUP_ENABLED = process.env.CLEANUP_ENABLED === 'true';

let cleanupJob = null;

const runCleanup = async () => {
  if (!CLEANUP_ENABLED) {
    console.log('[Cleanup] Skipped. Set CLEANUP_ENABLED=true in .env to enable.');
    return;
  }

  console.log(`[Cleanup] Started at ${new Date().toISOString()}`);

  const models = [
    { name: 'Message', model: require('../models/Message') },
    { name: 'Chat', model: require('../models/Chat') },
    { name: 'AuditLog', model: require('../models/AuditLog') },
    { name: 'ScheduledCampaign', model: require('../models/ScheduledCampaign') },
    { name: 'AutoReply', model: require('../models/AutoReply') },
    { name: 'FollowUp', model: require('../models/FollowUp') },
    { name: 'SupportTicket', model: require('../models/SupportTicket') },
    { name: 'Transaction', model: require('../models/Transaction') },
    { name: 'Invoice', model: require('../models/Invoice') },
    { name: 'Setting', model: require('../models/Setting') },
    { name: 'ApiKey', model: require('../models/ApiKey') },
    { name: 'Subscriber', model: require('../models/Subscriber') },
    { name: 'AIChat', model: require('../models/AIChat') },
    { name: 'WebhookEndpoint', model: require('../models/WebhookEndpoint') },
    { name: 'TeamMember', model: require('../models/TeamMember') },
    { name: 'AutomationFlow', model: require('../models/AutomationFlow') },
    { name: 'Compliance', model: require('../models/Compliance') },
    { name: 'GroupScrape', model: require('../models/GroupScrape') },
    { name: 'AutoCaptureLog', model: require('../models/AutoCaptureLog') },
    { name: 'EcommerceIntegration', model: require('../models/EcommerceIntegration') },
    { name: 'SmsFallbackLog', model: require('../models/SmsFallbackLog') },
    { name: 'TeamInbox', model: require('../models/TeamInbox') },
    { name: 'KnowledgeBase', model: require('../models/KnowledgeBase') },
  ];

  const retentionDays = parseInt(process.env.CLEANUP_RETENTION_DAYS || '90');
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const results = {};

  for (const { name, model } of models) {
    try {
      const filter = name === 'Setting' || name === 'ApiKey' || name === 'Subscriber'
        ? { updatedAt: { $lt: cutoffDate } }
        : { createdAt: { $lt: cutoffDate } };
      const d = await model.deleteMany(filter);
      results[name] = d.deletedCount;
    } catch (err) {
      results[name] = `ERROR: ${err.message}`;
    }
  }

  console.log(`[Cleanup] Done: ${JSON.stringify(results)}`);
};

const startCleanupSchedule = () => {
  if (cleanupJob) return;
  if (!CLEANUP_ENABLED) {
    console.log('[Cleanup] Schedule not started. Set CLEANUP_ENABLED=true in .env to enable.');
    return;
  }
  cleanupJob = cron.schedule(SCHEDULE, runCleanup);
  console.log(`[Cleanup] Schedule set: ${SCHEDULE}`);
};

const stopCleanupSchedule = () => {
  if (cleanupJob) { cleanupJob.stop(); cleanupJob = null; }
};

module.exports = { startCleanupSchedule, stopCleanupSchedule, runCleanup };
