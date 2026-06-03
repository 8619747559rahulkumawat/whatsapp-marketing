const mongoose = require('mongoose');

const quoteItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, required: true },
  description: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  taxRate: { type: Number, default: 0 },
  discount: { type: Number, default: 0 }
}, { _id: false });

const quoteSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  dealId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal' },
  quoteNumber: { type: String, required: true, trim: true },
  contactName: { type: String, trim: true },
  contactPhone: { type: String, trim: true },
  contactEmail: { type: String, lowercase: true, trim: true },
  items: [quoteItemSchema],
  subtotal: { type: Number, default: 0 },
  taxTotal: { type: Number, default: 0 },
  discountTotal: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  status: {
    type: String,
    enum: ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'],
    default: 'draft'
  },
  validUntil: { type: Date },
  notes: { type: String, default: '' },
  terms: { type: String, default: '' },
  sentAt: { type: Date },
  acceptedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

quoteSchema.index({ tenantId: 1, userId: 1 });
quoteSchema.index({ tenantId: 1, quoteNumber: 1 }, { unique: true });

module.exports = mongoose.model('Quote', quoteSchema);
