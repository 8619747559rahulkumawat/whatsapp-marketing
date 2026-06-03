const mongoose = require('mongoose');

const widgetSchema = new mongoose.Schema({
  type: { type: String, required: true },
  title: { type: String, required: true },
  size: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
  position: { x: Number, y: Number },
  settings: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const dashboardConfigSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, default: 'Main Dashboard' },
  widgets: [widgetSchema],
  isDefault: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

dashboardConfigSchema.index({ tenantId: 1, userId: 1 });

module.exports = mongoose.model('DashboardConfig', dashboardConfigSchema);
