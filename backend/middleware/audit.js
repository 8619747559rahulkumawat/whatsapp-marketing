const AuditLog = require('../models/AuditLog');

const auditMiddleware = (action, resource) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = async function (body) {
      try {
        if (res.statusCode < 400 && req.user && req.tenant) {
          await AuditLog.create({
            tenantId: req.tenant._id,
            userId: req.user._id,
            action: action || req.method.toLowerCase(),
            resource: resource || req.path,
            resourceId: req.params.id || req.body?._id || '',
            details: {
              method: req.method,
              path: req.path,
              body: sanitizeBody(req.body),
              statusCode: res.statusCode
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || ''
          });
        }
      } catch (err) {
        console.error('Audit log error:', err.message);
      }
      return originalJson(body);
    };
    next();
  };
};

function sanitizeBody(body) {
  if (!body) return {};
  const sanitized = { ...body };
  delete sanitized.password;
  delete sanitized.currentPassword;
  delete sanitized.newPassword;
  delete sanitized.confirmPassword;
  delete sanitized.secret;
  delete sanitized.apiKey;
  return sanitized;
}

module.exports = { auditMiddleware };
