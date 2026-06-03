const mongoose = require('mongoose');

const ecommerceIntegrationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  platform: { type: String, enum: ['shopify', 'woocommerce'], required: true },
  storeName: { type: String, required: true },
  storeUrl: { type: String, required: true },
  apiKey: { type: String, default: '' },
  apiSecret: { type: String, default: '' },
  accessToken: { type: String, default: '' },
  webhookSecret: { type: String, default: '' },
  settings: {
    autoSync: { type: Boolean, default: false },
    syncInterval: { type: Number, default: 15 },
    abandonedCart: { type: Boolean, default: true },
    cartTimeout: { type: Number, default: 30 },
    orderNotifications: { type: Boolean, default: true },
    paymentReminders: { type: Boolean, default: true },
    autoApplyCoupon: { type: Boolean, default: false },
    couponCode: { type: String, default: '' },
    fallbackSessionId: { type: String, default: '' }
  },
  stats: {
    totalOrders: { type: Number, default: 0 },
    abandonedCarts: { type: Number, default: 0 },
    recoveredCarts: { type: Number, default: 0 },
    notificationsSent: { type: Number, default: 0 },
    lastSyncAt: { type: Date }
  },
  isActive: { type: Boolean, default: true },
  lastSyncAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ecommerceIntegrationSchema.index({ tenantId: 1, platform: 1 });
ecommerceIntegrationSchema.index({ storeUrl: 1 });

module.exports = mongoose.model('EcommerceIntegration', ecommerceIntegrationSchema);
