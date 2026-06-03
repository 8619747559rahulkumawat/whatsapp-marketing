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
    enum: ['draft', 'running', 'paused', 'completed', 'failed', 'cancelled'],
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
  delay: { type: Number, default: 2000 },
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

module.exports = mongoose.model('Campaign', campaignSchema);
