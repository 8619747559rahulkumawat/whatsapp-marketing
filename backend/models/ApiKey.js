const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  key: { type: String, required: true, unique: true },
  permissions: [{ type: String, enum: ['send', 'campaign', 'contacts', 'reports', 'webhook'] }],
  isActive: { type: Boolean, default: true },
  lastUsed: { type: Date },
  webhookUrl: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for better query performance
apiKeySchema.index({ tenantId: 1, userId: 1 });
apiKeySchema.index({ key: 1 }, { unique: true });

module.exports = mongoose.model('ApiKey', apiKeySchema);
