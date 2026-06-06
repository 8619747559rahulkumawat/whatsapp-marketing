const { Queue, Worker, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');

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
connection.on('error', (err) => console.warn('[Queue] Redis connection error:', err.message));

let messageQueue = null;
let campaignQueue = null;
let queueEvents = null;
let campaignQueueEvents = null;
const fallbackStats = { waiting: 0, active: 0, completed: 0, failed: 0 };
const fallbackTimers = new Set();

const queueReady = (async () => {
  try {
    await connection.connect();
    messageQueue = new Queue('whatsapp-messages', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
    campaignQueue = new Queue('campaign-processing', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
    queueEvents = new QueueEvents('whatsapp-messages', { connection });
    campaignQueueEvents = new QueueEvents('campaign-processing', { connection });
    setupWorkers();
    return { messageQueue, campaignQueue };
  } catch (err) {
    console.warn('Redis unavailable - queue features will use direct mode');
    return null;
  }
})();

// Job processors
const processMessageJob = async (job) => {
  const data = job.data?.data || job.data;
  const { to, messageType, content, mediaUrl, buttons, sessionId } = data;
  
  // Import whatsappService here to avoid circular dependencies
  const whatsappService = require('./whatsappService');
  
  try {
    let result;
    if (buttons && buttons.length > 0) {
      result = await whatsappService.sendButtonMessage(sessionId, to, content, buttons);
    } else if (mediaUrl && messageType !== 'text') {
      result = await whatsappService.sendMediaMessage(sessionId, to, mediaUrl, messageType, content);
    } else {
      result = await whatsappService.sendTextMessage(sessionId, to, content);
    }
    
    // Return the result so we can handle success
    return { success: true, messageId: result.id || '' };
  } catch (error) {
    // Throw error so BullMQ can handle retries
    throw new Error(`Failed to send message: ${error.message}`);
  }
};

const processCampaignJob = async (job) => {
  const data = job.data?.data || job.data;
  const { campaignId } = data;
  
  // Import services here to avoid circular dependencies
  const campaignService = require('./campaignService');
  const { getIoInstance } = require('../socket'); // Assuming we have a socket instance getter
  
  try {
    // Process the campaign
    await campaignService.processCampaign(campaignId, getIoInstance());
    
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to process campaign: ${error.message}`);
  }
};

const runDirectJob = async (name, data, processor) => {
  const id = `direct_${name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  fallbackStats.active += 1;
  try {
    const returnvalue = await processor({ id, data });
    fallbackStats.completed += 1;
    return { id, name, data, returnvalue, mode: 'direct' };
  } catch (error) {
    fallbackStats.failed += 1;
    throw error;
  } finally {
    fallbackStats.active = Math.max(0, fallbackStats.active - 1);
  }
};

let messageWorker = null;
let campaignWorker = null;

const setupWorkers = () => {
  if (!messageQueue) return;
  try {
    messageWorker = new Worker('whatsapp-messages', processMessageJob, {
      connection,
      concurrency: parseInt(process.env.MESSAGE_QUEUE_CONCURRENCY) || 5,
    });
    campaignWorker = new Worker('campaign-processing', processCampaignJob, {
      connection,
      concurrency: parseInt(process.env.CAMPAIGN_QUEUE_CONCURRENCY) || 2,
    });

    messageWorker.on('completed', (job) => {
      console.log(`Message job ${job.id} completed successfully`);
    });
    messageWorker.on('failed', (job, err) => {
      console.error(`Message job ${job.id} failed:`, err.message);
    });
    campaignWorker.on('completed', (job) => {
      console.log(`Campaign job ${job.id} completed successfully`);
    });
    campaignWorker.on('failed', (job, err) => {
      console.error(`Campaign job ${job.id} failed:`, err.message);
    });

    if (queueEvents) {
      queueEvents.on('completed', ({ jobId }) => {
        console.log(`Queue event: Job ${jobId} completed`);
      });
      queueEvents.on('failed', ({ jobId }, err) => {
        console.error(`Queue event: Job ${jobId} failed:`, err.message);
      });
    }
  } catch (err) {
    console.warn('BullMQ workers setup failed:', err.message);
  }
};

// Utility functions to add jobs to queues
const addMessageJob = async (data) => {
  await queueReady;
  if (!messageQueue) return runDirectJob('send-message', data, processMessageJob);
  return messageQueue.add('send-message', data);
};

const addCampaignJob = async (data) => {
  await queueReady;
  if (!campaignQueue) return runDirectJob('process-campaign', data, processCampaignJob);
  return campaignQueue.add('process-campaign', data);
};

// Schedule a job for future processing
const scheduleMessageJob = async (data, delayMs) => {
  await queueReady;
  if (!messageQueue) {
    const id = `direct_delayed_send-message_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    fallbackStats.waiting += 1;
    const timer = setTimeout(async () => {
      fallbackTimers.delete(timer);
      fallbackStats.waiting = Math.max(0, fallbackStats.waiting - 1);
      try {
        await runDirectJob('send-message', data, processMessageJob);
      } catch (error) {
        console.error(`Direct delayed message job ${id} failed:`, error.message);
      }
    }, Math.max(0, delayMs || 0));
    timer.unref?.();
    fallbackTimers.add(timer);
    return { id, name: 'send-message', data, delay: delayMs, mode: 'direct-delayed' };
  }
  return messageQueue.add('send-message', data, { delay: delayMs });
};

// Get queue status
const getQueueStatus = async () => {
  await queueReady;
  if (!messageQueue) return { ...fallbackStats, mode: 'direct' };
  const [waiting, active, completed, failed] = await Promise.all([
    messageQueue.getWaitCount(),
    messageQueue.getActiveCount(),
    messageQueue.getCompletedCount(),
    messageQueue.getFailedCount(),
  ]);
  return { waiting, active, completed, failed };
};

// Cleanup function (for graceful shutdown)
const shutdown = async () => {
  for (const timer of fallbackTimers) clearTimeout(timer);
  fallbackTimers.clear();
  if (messageWorker) await messageWorker.close();
  if (campaignWorker) await campaignWorker.close();
  if (messageQueue) await messageQueue.close();
  if (campaignQueue) await campaignQueue.close();
  await connection.quit().catch(() => {});
};

module.exports = {
  get messageQueue() {
    return messageQueue;
  },
  get campaignQueue() {
    return campaignQueue;
  },
  get messageWorker() {
    return messageWorker;
  },
  get campaignWorker() {
    return campaignWorker;
  },
  get queueEvents() {
    return queueEvents;
  },
  get campaignQueueEvents() {
    return campaignQueueEvents;
  },
  addMessageJob,
  addCampaignJob,
  scheduleMessageJob,
  getQueueStatus,
  shutdown,
};
