const mongoose = require('mongoose');
const { addRetentionIndex, compactObject, truncateText } = require('../utils/dataRetention');

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
addRetentionIndex(aiChatSchema, 'createdAt', 'AI_CHAT', 30);

aiChatSchema.pre('validate', function trimAIChatPayload(next) {
  this.content = truncateText(this.content, 4000);
  this.metadata = compactObject(this.metadata, 3000);
  next();
});

module.exports = mongoose.model('AIChat', aiChatSchema);
