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

;(async () => {
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
  } catch (err) {
    console.warn('Redis unavailable - queue features disabled');
  }
})();

// Job processors
const processMessageJob = async (job) => {
  const { to, messageType, content, mediaUrl, buttons, sessionId } = job.data;
  
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
  const { campaignId } = job.data;
  
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
const addMessageJob = (data) => {
  if (!messageQueue) throw new Error('Redis unavailable - cannot queue message');
  return messageQueue.add('send-message', { data });
};

const addCampaignJob = (data) => {
  if (!campaignQueue) throw new Error('Redis unavailable - cannot queue campaign');
  return campaignQueue.add('process-campaign', { data });
};

// Schedule a job for future processing
const scheduleMessageJob = (data, delayMs) => {
  if (!messageQueue) throw new Error('Redis unavailable - cannot schedule message');
  return messageQueue.add('send-message', { data, delay: delayMs });
};

// Get queue status
const getQueueStatus = async () => {
  if (!messageQueue) return { waiting: 0, active: 0, completed: 0, failed: 0 };
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
  if (messageWorker) await messageWorker.close();
  if (campaignWorker) await campaignWorker.close();
  if (messageQueue) await messageQueue.close();
  if (campaignQueue) await campaignQueue.close();
  await connection.quit().catch(() => {});
};

module.exports = {
  messageQueue,
  campaignQueue,
  messageWorker,
  campaignWorker,
  queueEvents,
  campaignQueueEvents,
  addMessageJob,
  addCampaignJob,
  scheduleMessageJob,
  getQueueStatus,
  shutdown,
};