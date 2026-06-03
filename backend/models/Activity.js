const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  dealId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal' },
  type: {
    type: String,
    enum: ['call', 'email', 'note', 'meeting', 'task', 'deal', 'message', 'system', 'quote'],
    required: true
  },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

activitySchema.index({ tenantId: 1, contactId: 1 });
activitySchema.index({ tenantId: 1, dealId: 1 });
activitySchema.index({ tenantId: 1, userId: 1 });

module.exports = mongoose.model('Activity', activitySchema);
