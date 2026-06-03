const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  dealId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal' },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  duration: { type: Number, default: 30 },
  type: { type: String, enum: ['video', 'phone', 'in_person'], default: 'video' },
  status: { type: String, enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled'], default: 'scheduled' },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  meetingLink: { type: String },
  location: { type: String },
  contactName: { type: String, trim: true },
  contactEmail: { type: String, lowercase: true, trim: true },
  contactPhone: { type: String, trim: true },
  notes: { type: String, default: '' },
  reminderSent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

meetingSchema.index({ tenantId: 1, userId: 1 });
meetingSchema.index({ tenantId: 1, startTime: 1 });
meetingSchema.index({ tenantId: 1, contactId: 1 });

module.exports = mongoose.model('Meeting', meetingSchema);
