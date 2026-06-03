const mongoose = require('mongoose');

const formFieldSchema = new mongoose.Schema({
  label: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['text', 'email', 'phone', 'textarea', 'select', 'checkbox', 'number'], default: 'text' },
  required: { type: Boolean, default: false },
  options: [{ type: String }],
  placeholder: { type: String },
  order: { type: Number, default: 0 }
}, { _id: false });

const webFormSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true },
  fields: [formFieldSchema],
  submitButtonText: { type: String, default: 'Submit' },
  successMessage: { type: String, default: 'Thank you! We will contact you soon.' },
  redirectUrl: { type: String },
  theme: {
    primaryColor: { type: String, default: '#7c3aed' },
    bgColor: { type: String, default: '#ffffff' },
    textColor: { type: String, default: '#1f2937' }
  },
  isActive: { type: Boolean, default: true },
  submissions: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

webFormSchema.index({ tenantId: 1, userId: 1 });
webFormSchema.index({ slug: 1 }, { unique: true });

module.exports = mongoose.model('WebForm', webFormSchema);
