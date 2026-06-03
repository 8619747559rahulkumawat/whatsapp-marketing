const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  contactName: { type: String, trim: true },
  contactPhone: { type: String, trim: true },
  contactEmail: { type: String, lowercase: true, trim: true },
  title: { type: String, required: true, trim: true },
  value: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  stage: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'],
    default: 'new'
  },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  source: { type: String, default: 'manual' },
  notes: { type: String, default: '' },
  expectedCloseDate: { type: Date },
  closedDate: { type: Date },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tags: [{ type: String }],
  lostReason: { type: String, default: '' },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

dealSchema.index({ tenantId: 1, userId: 1 });
dealSchema.index({ tenantId: 1, stage: 1 });

module.exports = mongoose.model('Deal', dealSchema);
