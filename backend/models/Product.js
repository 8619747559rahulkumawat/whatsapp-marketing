const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  category: { type: String, trim: true },
  sku: { type: String, trim: true },
  unit: { type: String, default: 'piece' },
  taxRate: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  image: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

productSchema.index({ tenantId: 1, userId: 1 });
productSchema.index({ tenantId: 1, category: 1 });

module.exports = mongoose.model('Product', productSchema);
