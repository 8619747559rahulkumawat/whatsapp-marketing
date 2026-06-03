const mongoose = require('mongoose');

const automationFlowSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  trigger: {
    type: { type: String, enum: ['contact_added', 'message_received', 'campaign_completed', 'scheduled', 'webhook', 'tag_added', 'form_submitted'], default: 'contact_added' },
    config: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  nodes: [{ type: mongoose.Schema.Types.Mixed }],
  edges: [{ type: mongoose.Schema.Types.Mixed }],
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'archived'],
    default: 'draft'
  },
  stats: {
    totalExecutions: { type: Number, default: 0 },
    successfulExecutions: { type: Number, default: 0 },
    failedExecutions: { type: Number, default: 0 },
    lastExecutedAt: { type: Date }
  },
  isDrip: { type: Boolean, default: false },
  dripConfig: {
    interval: { type: Number, default: 86400000 },
    maxMessages: { type: Number, default: 5 },
    condition: { type: String, default: '' }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

automationFlowSchema.index({ tenantId: 1, status: 1 });
automationFlowSchema.index({ userId: 1 });

module.exports = mongoose.model('AutomationFlow', automationFlowSchema);
