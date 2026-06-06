const cron = require('node-cron');
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const ScheduledCampaign = require('../models/ScheduledCampaign');
const campaignService = require('./campaignService');
const { getIoInstance, setIoInstance } = require('../socket');

const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || null,
  db: process.env.REDIS_DB || 0,
  retryStrategy: () => null,
  enableReadyCheck: false,
  lazyConnect: true,
  maxRetriesPerRequest: null,
};

const connection = new IORedis(redisOptions);
connection.on('error', (err) => console.warn('[Scheduler] Redis connection error:', err.message));
let scheduledQueue = null;

const queueReady = (async () => {
  try {
    await connection.connect();
    scheduledQueue = new Queue('scheduled-campaigns', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: 100,
        removeOnFail: 50
      }
    });
    return scheduledQueue;
  } catch (err) {
    console.warn('Redis unavailable - scheduler will use direct mode');
    return null;
  }
})();

const CHECK_INTERVAL = 60000;
let checkTimer = null;
let cronJobs = new Map();

const startScheduler = async (io) => {
  if (io) setIoInstance(io);
  await queueReady;

  if (checkTimer) return;
  if (!scheduledQueue) {
    console.log('Redis unavailable - scheduler running in direct mode');
  }

  checkTimer = setInterval(async () => {
    try {
      const now = new Date();
      const dueCampaigns = await ScheduledCampaign.find({
        status: 'pending',
        scheduledAt: { $lte: now }
      }).populate('campaignId').lean();

      for (const sc of dueCampaigns) {
        try {
          await queueOrProcessScheduledCampaign(sc, now, `sc_${sc._id}`);
        } catch (err) {
          console.error(`Error processing scheduled campaign ${sc._id}:`, err.message);
          await ScheduledCampaign.findByIdAndUpdate(sc._id, { status: 'failed' });
        }
      }
    } catch (err) {
      console.error('Scheduler check error:', err.message);
    }
  }, CHECK_INTERVAL);

  setupWorker();
  setupRecurringCrons();
};

const getCampaignId = (sc) => sc.campaignId?._id?.toString?.() || sc.campaignId?.toString?.();

const completeScheduledCampaign = async (scheduledCampaignId, campaignId) => {
  if (!campaignId) throw new Error('No campaignId in scheduled campaign');

  const io = getIoInstance();
  await campaignService.processCampaign(campaignId, io);

  const sc = await ScheduledCampaign.findById(scheduledCampaignId);
  if (sc) {
    sc.totalRuns += 1;
    if (sc.scheduleType === 'once') {
      sc.status = 'completed';
    } else {
      sc.lastRunAt = new Date();
      sc.nextRunAt = calculateNextRun(sc);
      sc.status = 'pending';
      if (sc.nextRunAt) {
        const campaign = await require('../models/Campaign').findById(campaignId);
        if (campaign) {
          campaign.status = 'draft';
          campaign.sentCount = 0;
          campaign.deliveredCount = 0;
          campaign.failedCount = 0;
          await campaign.save();
        }
      }
    }
    await sc.save();
  }

  return { success: true, campaignId };
};

const queueOrProcessScheduledCampaign = async (sc, now, jobId) => {
  const campaignId = getCampaignId(sc);
  const update = {
    status: 'running',
    lastRunAt: now,
    queueJobId: scheduledQueue ? jobId : ''
  };

  if (scheduledQueue) {
    await scheduledQueue.add('process-scheduled', {
      scheduledCampaignId: sc._id.toString(),
      campaignId,
      tenantId: sc.tenantId?.toString(),
      userId: sc.userId?.toString()
    }, {
      jobId,
      removeOnComplete: true
    });

    await ScheduledCampaign.findByIdAndUpdate(sc._id, update);
    return;
  }

  await ScheduledCampaign.findByIdAndUpdate(sc._id, update);
  await completeScheduledCampaign(sc._id.toString(), campaignId);
};

const setupWorker = () => {
  if (!scheduledQueue) return;
  const worker = new Worker('scheduled-campaigns', async (job) => {
    const { campaignId, scheduledCampaignId } = job.data;
    return completeScheduledCampaign(scheduledCampaignId, campaignId);
  }, { connection, concurrency: 3 });

  worker.on('failed', async (job, err) => {
    console.error(`Scheduled campaign job ${job?.id} failed:`, err.message);
    if (job?.data?.scheduledCampaignId) {
      await ScheduledCampaign.findByIdAndUpdate(job.data.scheduledCampaignId, { status: 'failed' });
    }
  });
};

const calculateNextRun = (sc) => {
  const now = new Date();
  if (sc.scheduleType === 'daily') {
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    if (sc.repeatConfig?.time) {
      const [h, m] = sc.repeatConfig.time.split(':');
      next.setHours(parseInt(h), parseInt(m), 0, 0);
    }
    return next;
  }
  if (sc.scheduleType === 'weekly') {
    const next = new Date(now);
    const targetDay = sc.repeatConfig?.dayOfWeek || 0;
    const daysUntil = (targetDay - next.getDay() + 7) % 7 || 7;
    next.setDate(next.getDate() + daysUntil);
    if (sc.repeatConfig?.time) {
      const [h, m] = sc.repeatConfig.time.split(':');
      next.setHours(parseInt(h), parseInt(m), 0, 0);
    }
    return next;
  }
  if (sc.scheduleType === 'monthly') {
    const next = new Date(now);
    const targetDay = sc.repeatConfig?.dayOfMonth || 1;
    next.setDate(targetDay);
    if (next <= now) next.setMonth(next.getMonth() + 1);
    if (sc.repeatConfig?.time) {
      const [h, m] = sc.repeatConfig.time.split(':');
      next.setHours(parseInt(h), parseInt(m), 0, 0);
    }
    return next;
  }
  return null;
};

const setupRecurringCrons = () => {
  const tasks = {
    'daily': '0 0 * * *',
    'hourly': '0 * * * *',
    'every-30min': '*/30 * * * *'
  };

  for (const [name, pattern] of Object.entries(tasks)) {
    if (cronJobs.has(name)) continue;
    const job = cron.schedule(pattern, async () => {
      try {
        const now = new Date();
        const recurring = await ScheduledCampaign.find({
          status: 'pending',
          scheduleType: { $in: ['daily', 'weekly', 'monthly'] },
          nextRunAt: { $lte: now, $ne: null }
        });
        for (const sc of recurring) {
          await queueOrProcessScheduledCampaign(sc, now, `sc_recurring_${sc._id}`);
        }
      } catch (err) {
        console.error(`Cron ${name} error:`, err.message);
      }
    });
    cronJobs.set(name, job);
  }
};

const stopScheduler = async () => {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
  for (const [, job] of cronJobs) job.stop();
  cronJobs.clear();
  if (scheduledQueue) await scheduledQueue.close();
  await connection.quit().catch(() => {});
};

const scheduleCampaign = async (campaignId, scheduledAt, scheduleType = 'once', timezone = 'Asia/Kolkata', repeatConfig = {}) => {
  await queueReady;
  const campaign = await require('../models/Campaign').findById(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  const sc = await ScheduledCampaign.create({
    tenantId: campaign.tenantId,
    userId: campaign.userId,
    campaignId: campaign._id,
    scheduleType,
    scheduledAt: new Date(scheduledAt),
    timezone,
    repeatConfig,
    nextRunAt: new Date(scheduledAt),
    status: 'pending'
  });

  return sc;
};

module.exports = {
  startScheduler,
  stopScheduler,
  scheduleCampaign,
  calculateNextRun,
  get scheduledQueue() {
    return scheduledQueue;
  }
};
