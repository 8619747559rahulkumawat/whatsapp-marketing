const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, default: '' },
  businessName: { type: String, default: '' },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'reseller', 'user', 'super_admin', 'agent', 'viewer'], default: 'user' },
  parentUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  credits: { type: Number, default: 0 },
  totalCreditsUsed: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  avatar: { type: String, default: '' },
  apiKey: { type: String, unique: true, sparse: true },
  settings: {
    dailyLimit: { type: Number, default: 1000 },
    senderName: { type: String, default: '' }
  },
  lastLogin: { type: Date }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
