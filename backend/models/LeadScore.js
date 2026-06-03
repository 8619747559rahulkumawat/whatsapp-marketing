const mongoose = require('mongoose');

const leadScoreSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
  score: { type: Number, default: 0, min: 0, max: 100 },
  level: { type: String, enum: ['cold', 'warm', 'hot'], default: 'cold' },
  factors: {
    emailOpens: { type: Number, default: 0 },
    emailClicks: { type: Number, default: 0 },
    messageReplies: { type: Number, default: 0 },
    websiteVisits: { type: Number, default: 0 },
    formSubmissions: { type: Number, default: 0 },
    meetingAttendance: { type: Number, default: 0 },
    dealValue: { type: Number, default: 0 },
    recency: { type: Number, default: 0 }
  },
  lastActivity: { type: Date },
  updatedAt: { type: Date, default: Date.now }
});

leadScoreSchema.index({ tenantId: 1, contactId: 1 }, { unique: true });
leadScoreSchema.index({ tenantId: 1, score: -1 });

module.exports = mongoose.model('LeadScore', leadScoreSchema);
