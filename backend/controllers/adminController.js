const User = require('../models/User');
const Session = require('../models/Session');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const Transaction = require('../models/Transaction');
const Setting = require('../models/Setting');
const { calculatePagination } = require('../utils/helpers');

exports.getAdminDashboard = async (req, res) => {
  try {
    const [
      totalUsers,
      totalSessions,
      totalCampaigns,
      totalContacts,
      activeSessions,
      recentUsers,
      recentCampaigns
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      Session.countDocuments(),
      Campaign.countDocuments(),
      Contact.countDocuments(),
      Session.countDocuments({ status: 'connected' }),
      User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 }).limit(10).select('name email credits role isActive createdAt'),
      Campaign.find().populate('userId', 'name email').sort({ createdAt: -1 }).limit(10)
    ]);
    const totalCreditsUsed = await Transaction.aggregate([
      { $match: { type: 'debit', tenantId: req.user.tenantId } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Anonymize recent users data for admin dashboard
    const anonymizedRecentUsers = recentUsers.map(user => {
      const userObj = user.toObject ? user.toObject() : { ...user };
      // Replace actual name and email with anonymized versions
      userObj.name = `User${userObj._id.toString().slice(-6)}`;
      userObj.email = `user${userObj._id.toString().slice(-6)}@private.com`;
      return userObj;
    });
    
    // Anonymize recent campaigns data for admin dashboard
    const anonymizedRecentCampaigns = recentCampaigns.map(campaign => {
      const campaignObj = campaign.toObject ? campaign.toObject() : { ...campaign };
      // Anonymize user info in campaign
      if (campaignObj.userId) {
        const userIdStr = campaignObj.userId._id ? campaignObj.userId._id.toString() : campaignObj.userId.toString();
        campaignObj.userId = {
          _id: userIdStr,
          name: `User${userIdStr.slice(-6)}`,
          email: `user${userIdStr.slice(-6)}@private.com`
        };
      }
      return campaignObj;
    });
    
    const totalRevenue = await Transaction.aggregate([
      { $match: { type: 'credit' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    res.json({
      success: true,
      stats: {
        totalUsers,
        totalSessions,
        totalCampaigns,
        // totalMessages removed for admin privacy
        totalContacts,
        totalCreditsUsed,
        activeSessions,
        totalRevenue: totalRevenue[0]?.total || 0
      },
      recentUsers: anonymizedRecentUsers,
      recentCampaigns: anonymizedRecentCampaigns
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const filter = {};
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    const { skip, limit, page } = calculatePagination(req.query.page, req.query.limit);
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-password')
      .populate('tenantId', 'plan status');
    // Attach plan directly for frontend convenience
    const usersWithPlan = users.map(u => {
      const obj = u.toObject ? u.toObject() : { ...u };
      obj.plan = obj.tenantId?.plan || 'free';
      return obj;
    });
    const total = await User.countDocuments(filter);
    res.json({
      success: true,
      users: usersWithPlan,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateMyCredits = async (req, res) => {
  try {
    const { credits } = req.body;
    if (credits === undefined || credits < 0) {
      return res.status(400).json({ success: false, message: 'Valid credits required' });
    }
    const user = await User.findById(req.user._id);
    const balanceBefore = user.credits;
    user.credits = credits;
    await user.save();
    await Transaction.create({
      userId: user._id,
      tenantId: req.user.tenantId,
      type: credits > balanceBefore ? 'credit' : 'debit',
      amount: Math.abs(credits - balanceBefore),
      balanceBefore,
      balanceAfter: credits,
      description: 'Admin self-update credits',
      status: 'completed'
    });
    res.json({ success: true, credits: user.credits });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, credits, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password required' });
    }
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      credits: credits || 0,
      role: role || 'user',
      tenantId: req.user.tenantId,
      apiKey: require('../utils/helpers').generateApiKey()
    });
    if (credits > 0) {
      await Transaction.create({
        userId: user._id,
        tenantId: req.user.tenantId,
        type: 'credit',
        amount: credits,
        balanceBefore: 0,
        balanceAfter: credits,
        description: 'Admin created account with credits',
        status: 'completed'
      });
    }
    res.status(201).json({ success: true, user: { ...user.toJSON(), password: undefined } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, credits, isActive, password } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (credits !== undefined) updates.credits = credits;
    if (isActive !== undefined) updates.isActive = isActive;
    if (password) {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      user.password = password;
      await user.save();
      const updated = await User.findById(req.params.id).select('-password');
      return res.json({ success: true, user: updated });
    }
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    await Session.deleteMany({ userId: req.params.id });
    await Campaign.deleteMany({ userId: req.params.id });
    await Contact.deleteMany({ userId: req.params.id });
    await Transaction.deleteMany({ userId: req.params.id });
    res.json({ success: true, message: 'User and all associated data deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSettings = async (req, res) => {
  try {
    const settings = await Setting.find();
    const settingsMap = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }
    res.json({ success: true, settings: settingsMap });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSetting = async (req, res) => {
  try {
    const { key, value } = req.body;
    const setting = await Setting.findOneAndUpdate(
      { key },
      { value, updatedBy: req.user._id, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ success: true, setting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllTransactions = async (req, res) => {
  try {
    const { skip, limit, page } = calculatePagination(req.query.page, req.query.limit);
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.userId) filter.userId = req.query.userId;
    const transactions = await Transaction.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await Transaction.countDocuments(filter);
    res.json({
      success: true,
      transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateUserPlan = async (req, res) => {
  try {
    const { plan } = req.body;
    const validPlans = ['free', 'starter', 'professional', 'enterprise'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan. Must be: ' + validPlans.join(', ') });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const Tenant = require('../models/Tenant');
    const tenant = await Tenant.findById(user.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });
    tenant.plan = plan;
    tenant.status = 'active';
    if (plan === 'free') {
      tenant.settings.limits = { contacts: 100, messagesPerDay: 100, users: 1 };
    } else if (plan === 'starter') {
      tenant.settings.limits = { contacts: 5000, messagesPerDay: 5000, users: 3 };
    } else if (plan === 'professional') {
      tenant.settings.limits = { contacts: 25000, messagesPerDay: 25000, users: 10 };
    } else if (plan === 'enterprise') {
      tenant.settings.limits = { contacts: 100000, messagesPerDay: 100000, users: 50 };
    }
    await tenant.save();
    res.json({ success: true, message: `User plan upgraded to ${plan}`, user: { ...user.toJSON(), plan: tenant.plan } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSubscriptions = async (req, res) => {
  try {
    const { skip, limit, page } = require('../utils/helpers').calculatePagination(req.query.page, req.query.limit);
    const Tenant = require('../models/Tenant');
    const subscriptions = await Tenant.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('name plan status billing createdAt');
    const total = await Tenant.countDocuments();
    res.json({
      success: true,
      subscriptions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSubscriptionStats = async (req, res) => {
  try {
    const Tenant = require('../models/Tenant');
    const [total, byPlan, byStatus] = await Promise.all([
      Tenant.countDocuments(),
      Tenant.aggregate([{ $group: { _id: '$plan', count: { $sum: 1 } } }]),
      Tenant.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);
    const Invoice = require('../models/Invoice');
    const totalRevenue = await Invoice.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    res.json({
      success: true,
      stats: {
        total,
        byPlan: byPlan.reduce((acc, p) => { acc[p._id] = p.count; return acc; }, {}),
        byStatus: byStatus.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
        totalRevenue: totalRevenue[0]?.total || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
