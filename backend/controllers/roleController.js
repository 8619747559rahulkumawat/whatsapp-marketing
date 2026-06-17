const User = require('../models/User');

exports.getTeamMembers = async (req, res) => {
  try {
    const users = await User.find({ tenantId: req.tenant._id }).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { role, permissions } = req.body;
    const allowedRoles = ['admin', 'reseller', 'user', 'super_admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role, permissions: permissions || {}, updatedAt: new Date() },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPermissions = async (req, res) => {
  try {
    const rolePermissions = {
      super_admin: ['all'],
      admin: ['all'],
      manager: ['deals', 'tasks', 'contacts', 'email', 'reports', 'campaigns', 'meetings', 'products', 'quotes'],
      agent: ['contacts', 'tasks', 'deals_read', 'email_send', 'meetings'],
      user: ['contacts_read', 'tasks_read']
    };
    res.json({ success: true, permissions: rolePermissions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
