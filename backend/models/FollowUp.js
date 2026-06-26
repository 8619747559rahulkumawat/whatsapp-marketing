const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, default: '' },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
  message: { type: String, required: true },
  waitHours: { type: Number, default: 24 },
  maxFollowUps: { type: Number, default: 3 },
  isActive: { type: Boolean, default: true },
  lastRunAt: { type: Date }
}, { timestamps: true });

followUpSchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model('FollowUp', followUpSchema);
