const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['credit', 'debit', 'refund'], required: true },
  amount: { type: Number, required: true },
  balanceBefore: { type: Number, default: 0 },
  balanceAfter: { type: Number, default: 0 },
  description: { type: String, default: '' },
  reference: { type: String, default: '' },
  relatedTo: {
    model: { type: String, enum: ['Campaign', 'Message', 'User'], default: null },
    id: { type: mongoose.Schema.Types.ObjectId, default: null }
  },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
  paymentMethod: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

// Indexes for better query performance
transactionSchema.index({ tenantId: 1, userId: 1 });
transactionSchema.index({ tenantId: 1, createdAt: -1 });
transactionSchema.index({ 'relatedTo.model': 1, 'relatedTo.id': 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
