const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true }, // e.g., 'Starter', 'Professional'
  description: { type: String, trim: true },
  price: { type: Number, required: true }, // Price in the smallest currency unit (e.g., cents for USD, paise for INR)
  currency: { type: String, required: true, default: 'INR' }, // ISO 4217 currency code
  interval: { type: String, enum: ['day', 'week', 'month', 'year'], default: 'month' },
  intervalCount: { type: Number, default: 1 }, // e.g., 2 for every 2 months
  trialPeriodDays: { type: Number, default: 0 },
  features: { type: [String], default: [] }, // List of feature names
  limits: {
    contacts: { type: Number, default: 0 }, // 0 for unlimited
    messagesPerDay: { type: Number, default: 0 },
    users: { type: Number, default: 0 },
    sessions: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
subscriptionPlanSchema.index({ isActive: 1 });
subscriptionPlanSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);