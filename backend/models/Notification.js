const mongoose = require('mongoose');
const { addRetentionIndex, compactObject, truncateText } = require('../utils/dataRetention');

const notificationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['lead', 'deal', 'task', 'meeting', 'email', 'system', 'goal', 'contract', 'survey'], required: true },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  link: { type: String },
  read: { type: Boolean, default: false },
  metadata: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ tenantId: 1, userId: 1, read: 1 });
notificationSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
addRetentionIndex(notificationSchema, 'createdAt', 'READ_NOTIFICATION', 30, {
  partialFilterExpression: { read: true }
});

notificationSchema.pre('validate', function trimNotificationPayload(next) {
  this.message = truncateText(this.message, 1000);
  this.metadata = compactObject(this.metadata, 3000);
  next();
});

module.exports = mongoose.model('Notification', notificationSchema);
