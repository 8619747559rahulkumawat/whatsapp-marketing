const mongoose = require('mongoose');

const autoCaptureLogSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },
  field: { type: String, required: true },
  value: { type: String, required: true },
  source: { type: String, enum: ['auto_detect', 'bot_collect', 'manual_input'], default: 'auto_detect' },
  confidence: { type: Number, default: 1.0 },
  applied: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

autoCaptureLogSchema.index({ tenantId: 1, contactId: 1 });
autoCaptureLogSchema.index({ field: 1 });

module.exports = mongoose.model('AutoCaptureLog', autoCaptureLogSchema);
