class MessageQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.handlers = new Map();
  }

  add(job) {
    this.queue.push({
      ...job,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      addedAt: new Date(),
      attempts: 0
    });
    this.process();
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      try {
        const handler = this.handlers.get(job.type);
        if (handler) {
          job.attempts++;
          await handler(job);
        }
      } catch (err) {
        console.error(`Queue job ${job.id} failed:`, err.message);
        if (job.attempts < 3) {
          setTimeout(() => this.queue.push(job), 5000);
        }
      }
      if (job.delay && this.queue.length > 0) {
        await new Promise(r => setTimeout(r, job.delay));
      }
    }
    this.processing = false;
  }

  on(type, handler) {
    this.handlers.set(type, handler);
  }

  get length() {
    return this.queue.length;
  }

  clear() {
    this.queue = [];
  }
}

module.exports = new MessageQueue();
