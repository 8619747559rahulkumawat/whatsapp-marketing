const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  description: { type: String, default: '' },
  message: { type: String, default: '' },
  status: { type: String, enum: ['open', 'in_progress', 'pending', 'awaiting_feedback', 'resolved', 'closed'], default: 'open' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedByName: { type: String, default: '' },
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', default: null },
  adminReply: { type: String, default: '' },
  internalNotes: [{
    text: String,
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedByName: String,
    addedAt: { type: Date, default: Date.now }
  }],
  resolvedAt: { type: Date },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

supportTicketSchema.index({ tenantId: 1, status: 1 });
supportTicketSchema.index({ tenantId: 1, assignedTo: 1 });
supportTicketSchema.index({ userId: 1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
