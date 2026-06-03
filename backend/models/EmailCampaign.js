const mongoose = require('mongoose');

const emailCampaignSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  fromEmail: { type: String },
  fromName: { type: String },
  status: { type: String, enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'], default: 'draft' },
  recipients: [{ email: String, name: String, contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' } }],
  stats: { sent: { type: Number, default: 0 }, opened: { type: Number, default: 0 }, clicked: { type: Number, default: 0 }, bounced: { type: Number, default: 0 } },
  scheduledAt: { type: Date },
  sentAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EmailCampaign', emailCampaignSchema);
