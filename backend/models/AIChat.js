const mongoose = require('mongoose');

const aiChatSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String, default: '' },
  role: { type: String, enum: ['user', 'assistant', 'system'], default: 'user' },
  content: { type: String, required: true },
  type: {
    type: String,
    enum: ['chat', 'smart_reply', 'sentiment', 'optimize', 'suggestion'],
    default: 'chat'
  },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

aiChatSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
aiChatSchema.index({ sessionId: 1 });

module.exports = mongoose.model('AIChat', aiChatSchema);
