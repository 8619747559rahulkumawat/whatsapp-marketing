const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  dealId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal' },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending' },
  dueDate: { type: Date },
  completedAt: { type: Date },
  reminderAt: { type: Date },
  reminderSent: { type: Boolean, default: false },
  tags: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

taskSchema.index({ tenantId: 1, userId: 1 });
taskSchema.index({ tenantId: 1, assignedTo: 1 });
taskSchema.index({ tenantId: 1, status: 1 });
taskSchema.index({ tenantId: 1, dueDate: 1 });

module.exports = mongoose.model('Task', taskSchema);
