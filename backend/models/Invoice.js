const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invoiceNumber: { type: String, required: true, unique: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded'],
    default: 'draft'
  },
  items: [{
    description: { type: String },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number },
    total: { type: Number }
  }],
  billingDetails: {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    address: { type: String },
    gstin: { type: String }
  },
  paymentMethod: { type: String, default: '' },
  paymentId: { type: String, default: '' },
  razorpayOrderId: { type: String, default: '' },
  stripePaymentIntentId: { type: String, default: '' },
  dueDate: { type: Date },
  paidAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

invoiceSchema.index({ tenantId: 1, userId: 1 });
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ status: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
