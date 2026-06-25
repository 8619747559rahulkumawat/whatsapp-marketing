const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String, required: true, unique: true },
  whatsappId: { type: String, default: null, sparse: true },
  name: { type: String, default: '' },
  status: {
    type: String,
    enum: ['connected', 'connecting', 'disconnected', 'failed', 'timeout'],
    default: 'disconnected'
  },
  isActive: { type: Boolean, default: true },
  lastSeen: { type: Date },
  qr: { type: String, default: '' },
  qrCode: { type: String, default: '' },
  me: { type: mongoose.Schema.Types.Mixed, default: null },
  phone: { type: String, default: '' },
  battery: { type: String, default: '' },
  plug: { type: String, default: '' },
  version: { type: String, default: '' },
  description: { type: String, default: '' },
  uptime: { type: Number, default: 0 },
  pushname: { type: String, default: '' },
  skeleton: { type: String, default: '' },
  platform: { type: String, default: '' },
  headless: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },
  errorDetails: { type: mongoose.Schema.Types.Mixed, default: null },
  lastErrorAt: { type: Date },
  lastSynced: { type: Date, default: null },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ status: 1, isActive: 1 });

module.exports = mongoose.model('Session', sessionSchema);
