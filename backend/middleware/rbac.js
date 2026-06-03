const TeamMember = require('../models/TeamMember');

const rolePermissions = {
  super_admin: ['*'],
  admin: ['manage_team', 'manage_templates', 'manage_campaigns', 'manage_contacts', 'view_reports', 'manage_billing', 'manage_settings', 'manage_compliance', 'manage_api', 'manage_automation', 'manage_ai', 'manage_integrations', 'manage_sessions'],
  agent: ['manage_billing', 'manage_campaigns', 'manage_contacts', 'send_messages', 'view_reports', 'manage_chat'],
  viewer: ['manage_billing', 'view_reports', 'view_dashboard', 'view_campaigns', 'view_contacts'],
  user: ['manage_billing'],
  reseller: ['manage_billing']
};

const planFeatures = {
  free: ['*'],
  starter: ['*'],
  professional: ['*'],
  enterprise: ['*']
};

const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (req.user.role === 'super_admin') return next();

      const userPerms = rolePermissions[req.user.role];
      if (userPerms && (userPerms.includes('*') || userPerms.includes(requiredPermission))) {
        return next();
      }

      const teamMember = await TeamMember.findOne({ userId: req.user._id, tenantId: req.user.tenantId, isActive: true });
      if (!teamMember) {
        return res.status(403).json({ success: false, message: 'Access denied: No team permissions' });
      }

      const rolePerms = rolePermissions[teamMember.role] || [];
      if (rolePerms.includes('*') || rolePerms.includes(requiredPermission)) return next();

      const hasCustomPermission = teamMember.permissions?.some(p =>
        p.actions.includes(requiredPermission)
      );
      if (hasCustomPermission) return next();

      return res.status(403).json({ success: false, message: 'Access denied: Insufficient permissions' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Permission check error' });
    }
  };
};

const checkPlanFeature = (requiredFeature) => {
  return async (req, res, next) => {
    try {
      if (req.user.role === 'super_admin') return next();

      const plan = req.tenant?.plan || 'free';
      const allowedFeatures = planFeatures[plan] || planFeatures.free;
      if (allowedFeatures.includes('*') || allowedFeatures.includes(requiredFeature)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `Your ${plan} plan does not include this feature. Please upgrade your subscription.`
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Plan feature check error' });
    }
  };
};

const checkCredits = async (req, res, next) => {
  try {
    const user = req.user || req.apiUser;
    if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (user.role === 'admin' || user.role === 'super_admin') return next();
    const credits = user.credits || 0;
    if (credits <= 0) {
      return res.status(403).json({
        success: false,
        message: 'Your credits are finished. Please Subscribe to continue.',
        code: 'NO_CREDITS'
      });
    }
    // Check if user has enough credits for media messages (costs 2 credits)
    const messageType = req.body?.messageType || req.body?.type || 'text';
    const contactCount = req.body?.contacts?.length || req.body?.contactIds?.length || 1;
    const needed = messageType === 'text' ? contactCount : contactCount * 2;
    if (credits < needed) {
      return res.status(403).json({
        success: false,
        message: `Insufficient credits. Need ${needed}, have ${credits}.`,
        code: 'INSUFFICIENT_CREDITS',
        needed,
        available: credits
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Credit check error' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: `Access denied: Required role: ${roles.join(', ')}` });
    }
    next();
  };
};

module.exports = { checkPermission, checkPlanFeature, checkCredits, requireRole, rolePermissions, planFeatures };
