const Tenant = require('../models/Tenant');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const tenantMiddleware = async (req, res, next) => {
  try {
    // Check if user is attached to request (from auth middleware)
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // For super admin, allow access to all tenants or bypass tenant restrictions
    if (req.user.role === 'super_admin') {
      // Super admin can access any tenant by specifying tenantId in header or query
      const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
      if (tenantId) {
        const tenant = await Tenant.findById(tenantId);
        if (!tenant) {
          return res.status(404).json({ success: false, message: 'Tenant not found' });
        }
        req.tenant = tenant;
        // Audit log: super admin accessing another tenant
        AuditLog.create({
          tenantId: req.user.tenantId,
          userId: req.user._id,
          action: 'super_admin_tenant_switch',
          resource: 'tenant',
          resourceId: tenantId,
          details: { targetTenant: tenant.name, path: req.originalUrl }
        }).catch(() => {});
      } else if (req.user.tenantId) {
        // Use the super admin's own tenant if no specific tenant requested
        req.tenant = req.user.tenantId;
      }
      next();
      return;
    }

    // For regular users, use their associated tenant
    const user = await User.findById(req.user._id).populate('tenantId');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.tenantId) {
      return res.status(400).json({ success: false, message: 'User not associated with any tenant' });
    }

    req.tenant = user.tenantId;
    req.user = user; // Update user with populated tenant
    next();
  } catch (err) {
    console.error('Tenant middleware error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Optional: Tenant validation middleware for routes that require specific tenant access
const validateTenantAccess = (requiredTenantId) => {
  return async (req, res, next) => {
    try {
      if (req.user.role === 'super_admin') {
        // Super admin can access any tenant
        next();
        return;
      }

      // Check if user belongs to the required tenant
      if (req.tenant._id.toString() !== requiredTenantId.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied: Insufficient tenant permissions' 
        });
      }
      
      next();
    } catch (err) {
      console.error('Tenant validation error:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
};

module.exports = { tenantMiddleware, validateTenantAccess };