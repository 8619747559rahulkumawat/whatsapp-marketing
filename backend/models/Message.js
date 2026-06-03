const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null },
  sessionId: { type: String, default: '' },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  to: { type: String, required: true },
  recipientJid: { type: String, default: '' },
  messageType: {
    type: String,
    enum: ['text', 'image', 'video', 'document', 'audio', 'button'],
    default: 'text'
  },
  content: { type: String, default: '' },
  mediaUrl: { type: String, default: '' },
  status: {
    type: String,
    enum: ['queued', 'sent', 'delivered', 'failed', 'read', 'received'],
    default: 'queued'
  },
  waMessageId: { type: String, default: '' },
  statusReason: { type: String, default: '' },
  scheduledAt: { type: Date },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  queueOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

messageSchema.index({ userId: 1, status: 1 });
messageSchema.index({ campaignId: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ to: 1, userId: 1 });
messageSchema.index({ waMessageId: 1 });
messageSchema.index({ sessionId: 1, sentAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
