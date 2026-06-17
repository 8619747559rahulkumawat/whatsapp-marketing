const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  type: { type: String, enum: ['revenue', 'deals', 'leads', 'messages', 'meetings', 'custom'], required: true },
  target: { type: Number, required: true },
  current: { type: Number, default: 0 },
  unit: { type: String, default: 'count' },
  period: { type: String, enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'], default: 'monthly' },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

goalSchema.index({ tenantId: 1, status: 1 });

module.exports = mongoose.model('Goal', goalSchema);
