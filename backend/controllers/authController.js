const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { generateApiKey } = require('../utils/helpers');
const { sendEmail } = require('../services/emailService');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const generatePassword = (length = 12) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$&';
  return Array.from(crypto.randomBytes(length))
    .map(b => chars[b % chars.length])
    .join('');
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    const user = await User.findOne({ email: email.toLowerCase() }).populate('tenantId');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    user.lastLogin = new Date();
    await user.save();
    const token = generateToken(user);
    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        businessName: user.businessName,
        role: user.role,
        credits: user.credits,
        totalCreditsUsed: user.totalCreditsUsed,
        isActive: user.isActive,
        plan: user.tenantId?.plan || 'free',
        planStatus: user.tenantId?.status || 'active'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { name, email, phone, businessName } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email required' });
    }
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    const Setting = require('../models/Setting');
    const regSetting = await Setting.findOne({ key: 'registrationOpen' });
    if (regSetting && regSetting.value === false) {
      return res.status(403).json({ success: false, message: 'Registration closed' });
    }
    const defaultCreditsSetting = await Setting.findOne({ key: 'defaultCredits' });
    const defaultCredits = defaultCreditsSetting ? defaultCreditsSetting.value : 100;
    const Tenant = require('../models/Tenant');
    const tenant = await Tenant.create({
      name: businessName || `${name}'s Business`,
      domain: `tenant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      plan: 'free',
      status: 'active',
      settings: {
        limits: { contacts: 100, messagesPerDay: 100, users: 1 }
      }
    });
    const autoPassword = generatePassword();
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone: phone || '',
      businessName: businessName || '',
      password: autoPassword,
      role: 'user',
      credits: defaultCredits,
      tenantId: tenant._id,
      apiKey: generateApiKey()
    });
    const token = generateToken(user);
    try {
      await sendEmail({
        to: user.email,
        subject: 'Welcome to RSendix.pro - Your Account Details',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #fff; padding: 40px; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #a855f7; font-size: 24px;">Welcome to RSendix.pro</h1>
            </div>
            <p style="color: #d1d5db; font-size: 16px;">Hello ${user.name},</p>
            <p style="color: #d1d5db; font-size: 14px;">Your account has been created successfully. Below are your login credentials:</p>
            <div style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; padding: 24px; margin: 24px 0;">
              <p style="margin: 8px 0;"><strong style="color: #a855f7;">Email:</strong> <span style="color: #fff;">${user.email}</span></p>
              <p style="margin: 8px 0;"><strong style="color: #a855f7;">Password:</strong> <span style="color: #fff;">${autoPassword}</span></p>
            </div>
            <p style="color: #9ca3af; font-size: 13px;">Please save this password securely. You can change it after logging in.</p>
            <div style="text-align: center; margin-top: 32px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" style="display: inline-block; background: linear-gradient(135deg, #a855f7, #7c3aed); color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: bold;">Login to Your Account</a>
            </div>
            <p style="color: #6b7280; font-size: 12px; margin-top: 32px; text-align: center;">You received this email because you registered on RSendix.pro.</p>
          </div>
        `
      });
    } catch (emailErr) {
      console.error('Failed to send welcome email:', emailErr.message);
    }
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      generatedPassword: autoPassword,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        businessName: user.businessName,
        role: user.role,
        credits: user.credits,
        plan: tenant.plan
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('tenantId');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({
      success: true,
      user: {
        ...user.toJSON(),
        plan: user.tenantId?.plan || 'free',
        planStatus: user.tenantId?.status || 'active'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, businessName } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (businessName !== undefined) updates.businessName = businessName;
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
