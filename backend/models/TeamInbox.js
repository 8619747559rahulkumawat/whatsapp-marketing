const mongoose = require('mongoose');

const teamInboxSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedByName: { type: String, default: '' },
  status: { type: String, enum: ['open', 'pending', 'resolved', 'closed'], default: 'open' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  internalNotes: [{
    text: String,
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedByName: String,
    addedAt: { type: Date, default: Date.now }
  }],
  tags: [{ type: String }],
  lastActivity: { type: Date, default: Date.now },
  responseTime: { type: Number, default: 0 },
  resolvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

teamInboxSchema.index({ tenantId: 1, status: 1 });
teamInboxSchema.index({ assignedTo: 1 });
teamInboxSchema.index({ chatId: 1 });

module.exports = mongoose.model('TeamInbox', teamInboxSchema);
