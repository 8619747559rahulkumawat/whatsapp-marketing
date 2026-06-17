const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  phone: { type: String, required: true, trim: true },
  name: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  city: { type: String, trim: true },
  address: { type: String, trim: true },
  tags: [{ type: String }],
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ContactGroup' }],
  variables: { type: mongoose.Schema.Types.Mixed, default: {} },
  customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  source: { type: String, default: 'manual' },
  isBlacklisted: { type: Boolean, default: false },
  blacklistReason: { type: String, default: '' },
  messageCount: { type: Number, default: 0 },
  lastMessaged: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

contactSchema.index({ tenantId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model('Contact', contactSchema);
