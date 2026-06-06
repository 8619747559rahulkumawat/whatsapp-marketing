const mongoose = require('mongoose');
const { addRetentionIndex, truncateText } = require('../utils/dataRetention');

const smsFallbackLogSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  phone: { type: String, required: true },
  content: { type: String, required: true },
  channel: { type: String, enum: ['twilio', 'local_sms'], default: 'twilio' },
  waStatus: { type: String, default: '' },
  smsStatus: { type: String, enum: ['pending', 'sent', 'delivered', 'failed'], default: 'pending' },
  smsProvider: { type: String, default: '' },
  smsMessageId: { type: String, default: '' },
  cost: { type: Number, default: 0 },
  errorMessage: { type: String, default: '' },
  retryCount: { type: Number, default: 0 },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

smsFallbackLogSchema.index({ tenantId: 1, phone: 1 });
smsFallbackLogSchema.index({ waStatus: 1 });
addRetentionIndex(smsFallbackLogSchema, 'createdAt', 'SMS_FALLBACK_LOG', 90);

smsFallbackLogSchema.pre('validate', function trimSmsFallbackPayload(next) {
  this.content = truncateText(this.content, 1000);
  this.errorMessage = truncateText(this.errorMessage, 500);
  next();
});

module.exports = mongoose.model('SmsFallbackLog', smsFallbackLogSchema);
