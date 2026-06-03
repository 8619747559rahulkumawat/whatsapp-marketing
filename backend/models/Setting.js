const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' }, // null for global settings
  key: { type: String, required: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  description: { type: String, default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for better query performance
settingSchema.index({ tenantId: 1, key: 1 }, { unique: true });
settingSchema.index({ updatedBy: 1 });

module.exports = mongoose.model('Setting', settingSchema);
