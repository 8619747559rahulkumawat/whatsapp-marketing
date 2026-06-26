const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { calculatePagination } = require('../utils/helpers');

exports.getBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('credits totalCreditsUsed');
    res.json({ success: true, balance: user.credits, totalUsed: user.totalCreditsUsed });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    const { skip, limit, page } = calculatePagination(req.query.page, req.query.limit);
    const transactions = await Transaction.find(filter)
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

exports.addCredits = async (req, res) => {
  try {
    const { userId, amount, description } = req.body;
    const user = await User.findOne({ _id: userId, tenantId: req.tenant._id });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const balanceBefore = user.credits;
    user.credits += amount;
    await user.save();
    await Transaction.create({
      userId: user._id,
      tenantId: user.tenantId,
      type: 'credit',
      amount,
      balanceBefore,
      balanceAfter: user.credits,
      description: description || 'Admin credit add',
      status: 'completed'
    });
    res.json({ success: true, balance: user.credits });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deductCredits = async (req, res) => {
  try {
    const { userId, amount, description } = req.body;
    const user = await User.findOne({ _id: userId, tenantId: req.tenant._id });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.credits < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient credits' });
    }
    const balanceBefore = user.credits;
    user.credits -= amount;
    await user.save();
    await Transaction.create({
      userId: user._id,
      tenantId: req.user.tenantId,
      type: 'debit',
      amount,
      balanceBefore,
      balanceAfter: user.credits,
      description: description || 'Admin debit',
      status: 'completed'
    });
    res.json({ success: true, balance: user.credits });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
