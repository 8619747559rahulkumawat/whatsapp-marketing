const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, default: 'general' },
  content: { type: String, required: true },
  variables: [{ type: String }], // Array of variable names like {{1}}, {{2}}, etc.
  language: { type: String, default: 'en' },
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'rejected'],
    default: 'draft'
  },
  whatsappTemplateId: { type: String, unique: true, sparse: true }, // ID from WhatsApp Business API
  rejectedReason: { type: String, default: '' },
  approvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for better query performance
templateSchema.index({ tenantId: 1, status: 1 });
templateSchema.index({ userId: 1 });
templateSchema.index({ category: 1 });
templateSchema.index({ whatsappTemplateId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Template', templateSchema);