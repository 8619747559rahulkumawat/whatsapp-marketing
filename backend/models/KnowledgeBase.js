const mongoose = require('mongoose');

const knowledgeBaseSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['pdf', 'txt', 'doc', 'website', 'manual'], required: true },
  content: { type: String, default: '' },
  chunks: [{ text: String, embedding: [Number], metadata: mongoose.Schema.Types.Mixed }],
  filePath: { type: String, default: '' },
  fileSize: { type: Number, default: 0 },
  chunkCount: { type: Number, default: 0 },
  status: { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

knowledgeBaseSchema.index({ tenantId: 1, userId: 1 });
knowledgeBaseSchema.index({ tenantId: 1, type: 1 });

module.exports = mongoose.model('KnowledgeBase', knowledgeBaseSchema);
