const mongoose = require('mongoose');

const scheduledCampaignSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  scheduleType: { type: String, enum: ['once', 'daily', 'weekly', 'monthly'], default: 'once' },
  scheduledAt: { type: Date, required: true },
  timezone: { type: String, default: 'Asia/Kolkata' },
  repeatConfig: {
    dayOfWeek: { type: Number, min: 0, max: 6 },
    dayOfMonth: { type: Number, min: 1, max: 31 },
    time: String
  },
  lastRunAt: { type: Date },
  nextRunAt: { type: Date },
  totalRuns: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'cancelled'], default: 'pending' },
  queueJobId: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

scheduledCampaignSchema.index({ tenantId: 1, status: 1 });
scheduledCampaignSchema.index({ nextRunAt: 1 }, { sparse: true });

module.exports = mongoose.model('ScheduledCampaign', scheduledCampaignSchema);
