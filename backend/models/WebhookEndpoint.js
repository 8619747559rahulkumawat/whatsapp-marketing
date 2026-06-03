const mongoose = require('mongoose');

const webhookEndpointSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  url: { type: String, required: true },
  secret: { type: String, default: '' },
  events: [{ type: String }],
  isActive: { type: Boolean, default: true },
  headers: { type: mongoose.Schema.Types.Mixed, default: {} },
  retryConfig: {
    maxRetries: { type: Number, default: 3 },
    retryInterval: { type: Number, default: 5000 }
  },
  lastTriggered: { type: Date },
  lastSuccess: { type: Date },
  lastFailure: { type: Date },
  failureCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

webhookEndpointSchema.index({ tenantId: 1, userId: 1 });
webhookEndpointSchema.index({ isActive: 1 });

module.exports = mongoose.model('WebhookEndpoint', webhookEndpointSchema);
