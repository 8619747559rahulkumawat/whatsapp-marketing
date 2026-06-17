const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  domain: { type: String, unique: true, sparse: true, trim: true }, // subdomain or custom domain
  plan: { 
    type: String, 
    enum: ['free', 'starter', 'professional', 'enterprise'], 
    default: 'free' 
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'cancelled', 'trial'],
    default: 'active'
  },
  settings: {
    whatsapp: {
      webhookUrl: { type: String, default: '' },
      webhookToken: { type: String, default: '' },
      messageTemplateSync: { type: Boolean, default: false }
    },
    notifications: {
      email: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true }
    },
    limits: {
      contacts: { type: Number, default: 1000 },
      messagesPerDay: { type: Number, default: 10000 },
      users: { type: Number, default: 5 }
    }
  },
  billing: {
    customerId: { type: String, default: '' }, // Stripe/Razorpay customer ID
    subscriptionId: { type: String, default: '' },
    currentPeriodEnd: { type: Date },
    invoiceDate: { type: Date }
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

tenantSchema.index({ status: 1 });

module.exports = mongoose.model('Tenant', tenantSchema);