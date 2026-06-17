const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  dealId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal' },
  title: { type: String, required: true, trim: true },
  contractNumber: { type: String, trim: true },
  value: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  fileUrl: { type: String },
  fileName: { type: String },
  fileSize: { type: Number },
  status: { type: String, enum: ['draft', 'active', 'completed', 'terminated', 'expired'], default: 'draft' },
  startDate: { type: Date },
  endDate: { type: Date },
  notes: { type: String, default: '' },
  signedBy: { type: String },
  signedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

contractSchema.index({ tenantId: 1, status: 1 });

module.exports = mongoose.model('Contract', contractSchema);
