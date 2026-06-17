const mongoose = require('mongoose');

const emailTemplateSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  subject: { type: String, default: '' },
  body: { type: String, default: '' },
  category: { type: String, default: 'general' },
  variables: [{ type: String }],
  isDefault: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

emailTemplateSchema.index({ tenantId: 1, category: 1 });

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);
