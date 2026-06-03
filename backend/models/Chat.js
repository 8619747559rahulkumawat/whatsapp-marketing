const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  senderName: { type: String, default: '' },
  senderRole: { type: String, enum: ['admin', 'user', 'super_admin'], default: 'user' },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  waPhone: { type: String, default: '' },
  message: { type: String, required: true },
  mediaUrl: { type: String, default: '' },
  mediaType: { type: String, default: 'text' },
  waName: { type: String, default: '' },
  profilePic: { type: String, default: '' },
  read: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Indexes for better query performance
chatSchema.index({ tenantId: 1, senderId: 1, createdAt: -1 });
chatSchema.index({ tenantId: 1, receiverId: 1, createdAt: -1 });
chatSchema.index({ tenantId: 1, waPhone: 1 });
chatSchema.index({ tenantId: 1, read: 1, receiverId: 1 });

module.exports = mongoose.model('Chat', chatSchema);
