const mongoose = require('mongoose');

const smsCampaignSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  message: { type: String, required: true },
  gateway: { type: String, enum: ['twilio', 'textlocal', 'msg91', 'custom'], default: 'twilio' },
  status: { type: String, enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'], default: 'draft' },
  recipients: [{ phone: String, name: String, contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' } }],
  stats: { sent: { type: Number, default: 0 }, delivered: { type: Number, default: 0 }, failed: { type: Number, default: 0 } },
  scheduledAt: { type: Date },
  sentAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SmsCampaign', smsCampaignSchema);
