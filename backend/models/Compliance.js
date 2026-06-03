const mongoose = require('mongoose');

const complianceSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
  type: {
    type: String,
    enum: ['opt_in', 'opt_out', 'consent_given', 'consent_withdrawn', 'dnd_check', 'gdpr_request'],
    required: true
  },
  phone: { type: String, required: true }, // Phone number for compliance tracking
  method: {
    type: String,
    enum: ['keyword', 'web_form', 'api', 'manual', 'import', 'gdpr_export', 'gdpr_delete'],
    default: 'manual'
  },
  keyword: { type: String, default: '' }, // For keyword-based opt-in/opt-out (STOP, START, etc.)
  timestamp: { type: Date, default: Date.now },
  ipAddress: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  details: { type: mongoose.Schema.Types.Mixed, default: {} }, // Additional details
  processed: { type: Boolean, default: false }, // Whether the compliance action has been processed
  processedAt: { type: Date },
  gdprRequestType: {
    type: String,
    enum: ['access', 'export', 'deletion', 'rectification'],
    default: null
  },
  gdprStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: null
  },
  gdprCompletedAt: { type: Date },
  gdprFilePath: { type: String, default: '' } // Path to exported GDPR data
});

// Indexes for better query performance
complianceSchema.index({ tenantId: 1, contactId: 1, type: 1 });
complianceSchema.index({ tenantId: 1, phone: 1 });
complianceSchema.index({ userId: 1, type: 1 });
complianceSchema.index({ timestamp: -1 });
complianceSchema.index({ gdprRequestType: 1, gdprStatus: 1 }, { sparse: true });

module.exports = mongoose.model('Compliance', complianceSchema);