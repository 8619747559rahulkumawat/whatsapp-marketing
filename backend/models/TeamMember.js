const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: {
    type: String,
    enum: ['agent', 'viewer', 'admin'],
    default: 'agent'
  },
  permissions: [{
    resource: { type: String },
    actions: [{ type: String, enum: ['create', 'read', 'update', 'delete'] }]
  }],
  assignedChats: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chat' }],
  isActive: { type: Boolean, default: true },
  joinedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

teamMemberSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
teamMemberSchema.index({ tenantId: 1, role: 1 });

module.exports = mongoose.model('TeamMember', teamMemberSchema);
