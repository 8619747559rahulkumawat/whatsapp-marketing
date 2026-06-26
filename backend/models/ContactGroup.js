const mongoose = require('mongoose');

const contactGroupSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String },
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }]
}, { timestamps: true });

contactGroupSchema.index({ tenantId: 1 });

module.exports = mongoose.model('ContactGroup', contactGroupSchema);
