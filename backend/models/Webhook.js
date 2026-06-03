const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  url: { type: String, required: true },
  events: [{ type: String, enum: ['contact.created', 'deal.updated', 'deal.stage_changed', 'message.sent', 'message.received', 'campaign.completed', 'form.submitted', 'meeting.created', 'task.completed'] }],
  secret: { type: String },
  isActive: { type: Boolean, default: true },
  lastTriggered: { type: Date },
  failureCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

webhookSchema.index({ tenantId: 1, userId: 1 });

module.exports = mongoose.model('Webhook', webhookSchema);
