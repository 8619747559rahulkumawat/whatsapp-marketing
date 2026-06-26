const mongoose = require('mongoose');

const autoReplySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, default: '' },
  keyword: { type: String, required: true },
  matchType: { type: String, enum: ['exact', 'contains', 'regex'], default: 'contains' },
  replyType: { type: String, enum: ['text', 'media'], default: 'text' },
  replyText: { type: String, default: '' },
  mediaUrl: { type: String, default: '' },
  sessionId: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  oncePerContact: { type: Boolean, default: false },
  sentContacts: [{ type: String }]
}, { timestamps: true });

autoReplySchema.index({ tenantId: 1, keyword: 1 });

module.exports = mongoose.model('AutoReply', autoReplySchema);
