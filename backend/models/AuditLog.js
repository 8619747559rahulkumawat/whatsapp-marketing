const mongoose = require('mongoose');
const { addRetentionIndex, compactObject, truncateText } = require('../utils/dataRetention');

const auditLogSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  resource: { type: String, required: true },
  resourceId: { type: String, default: '' },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipAddress: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
});

auditLogSchema.index({ tenantId: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, resource: 1 });
addRetentionIndex(auditLogSchema, 'timestamp', 'AUDIT_LOG', 180);

auditLogSchema.pre('validate', function trimAuditPayload(next) {
  this.details = compactObject(this.details, 4000);
  this.ipAddress = truncateText(this.ipAddress, 100);
  this.userAgent = truncateText(this.userAgent, 500);
  next();
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
