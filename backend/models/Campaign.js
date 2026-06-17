const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['bulk', 'dp', 'button', 'premium', 'brand', 'scheduled'],
    required: true
  },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
  status: {
    type: String,
    enum: ['draft', 'running', 'paused', 'completed', 'failed', 'cancelled', 'scheduled'],
    default: 'draft'
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'video', 'document', 'audio'],
    default: 'text'
  },
  message: { type: String, default: '' },
  mediaUrl: { type: String, default: '' },
  totalContacts: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  deliveredCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  pendingCount: { type: Number, default: 0 },
  skippedCount: { type: Number, default: 0 },
  delay: { type: Number, default: 2000 },
  minDelaySeconds: { type: Number, default: 20 },
  maxDelaySeconds: { type: Number, default: 45 },
  dailyLimit: { type: Number, default: 200 },
  requireOptIn: { type: Boolean, default: true },
  appendOptOut: { type: Boolean, default: true },
  stopOnHighFailureRate: { type: Boolean, default: true },
  safetySummary: {
    duplicates: { type: Number, default: 0 },
    blacklisted: { type: Number, default: 0 },
    optedOut: { type: Number, default: 0 },
    missingOptIn: { type: Number, default: 0 },
    alreadySent: { type: Number, default: 0 },
    invalidPhone: { type: Number, default: 0 },
    capped: { type: Boolean, default: false },
    notes: [{ type: String }]
  },
  isPersonalized: { type: Boolean, default: false },
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ContactGroup' }],
  scheduledAt: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  buttons: [{
    type: { type: String, enum: ['url', 'call', 'quick_reply'] },
    title: String,
    value: String
  }],
  automationFlow: { type: mongoose.Schema.Types.Mixed, default: null }, // { nodes: [], edges: [] }
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

campaignSchema.index({ tenantId: 1, status: 1 });

module.exports = mongoose.model('Campaign', campaignSchema);
