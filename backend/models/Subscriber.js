const mongoose = require('mongoose');

const subscriberSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
  phone: { type: String, required: true },
  status: {
    type: String,
    enum: ['subscribed', 'unsubscribed', 'blocked'],
    default: 'subscribed'
  },
  source: { type: String, default: 'manual' },
  subscribedAt: { type: Date, default: Date.now },
  unsubscribedAt: { type: Date },
  unsubscribedReason: { type: String, default: '' },
  lastConsentUpdate: { type: Date, default: Date.now },
  consentMethod: { type: String, default: '' },
  tags: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

subscriberSchema.index({ tenantId: 1, phone: 1 }, { unique: true });
subscriberSchema.index({ tenantId: 1, status: 1 });
subscriberSchema.index({ contactId: 1 });

module.exports = mongoose.model('Subscriber', subscriberSchema);
