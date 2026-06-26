const express = require('express');
const router = express.Router();
const integrationController = require('../controllers/integrationController');
const ecommerceService = require('../services/ecommerceService');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.get('/webhooks', auth, tenantMiddleware, integrationController.getWebhooks);
router.post('/webhooks', auth, tenantMiddleware, integrationController.createWebhook);
router.put('/webhooks/:id', auth, tenantMiddleware, integrationController.updateWebhook);
router.delete('/webhooks/:id', auth, tenantMiddleware, integrationController.deleteWebhook);
router.post('/webhooks/:id/test', auth, tenantMiddleware, integrationController.testWebhook);

router.get('/api-keys', auth, tenantMiddleware, integrationController.getApiKeys);
router.post('/api-keys', auth, tenantMiddleware, integrationController.createApiKey);
router.delete('/api-keys/:id', auth, tenantMiddleware, integrationController.deleteApiKey);

const webhookAuth = (platform) => {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_WEBHOOK_VERIFICATION === 'true') {
      return next();
    }
    const valid = platform === 'shopify'
      ? ecommerceService.verifyShopifyWebhook(req)
      : ecommerceService.verifyWooCommerceWebhook(req);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }
    next();
  };
};

const resolveTenantFromConfig = async (platform) => {
  const EcommerceIntegration = require('../models/EcommerceIntegration');
  const integrations = await EcommerceIntegration.find({ platform, isActive: true }).lean();
  return integrations.length > 0 ? integrations[0].tenantId : null;
};

// Shopify webhook endpoints (no auth - verified by HMAC)
router.post('/shopify/abandoned-checkout', webhookAuth('shopify'), async (req, res) => {
  try {
    const tenantId = await resolveTenantFromConfig('shopify');
    const result = await ecommerceService.handleAbandonedCheckout(req.body, 'shopify', tenantId, req.app.get('io'));
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/shopify/order-created', webhookAuth('shopify'), async (req, res) => {
  try {
    const tenantId = await resolveTenantFromConfig('shopify');
    const result = await ecommerceService.handleOrderCreated(req.body, 'shopify', tenantId, req.app.get('io'));
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/shopify/order-updated', webhookAuth('shopify'), async (req, res) => {
  try {
    const tenantId = await resolveTenantFromConfig('shopify');
    const result = await ecommerceService.handleOrderUpdated(req.body, 'shopify', tenantId, req.app.get('io'));
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// WooCommerce webhook endpoints (no auth - verified by signature)
router.post('/woocommerce/abandoned-checkout', webhookAuth('woocommerce'), async (req, res) => {
  try {
    const tenantId = await resolveTenantFromConfig('woocommerce');
    const result = await ecommerceService.handleAbandonedCheckout(req.body, 'woocommerce', tenantId, req.app.get('io'));
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/woocommerce/order-created', webhookAuth('woocommerce'), async (req, res) => {
  try {
    const tenantId = await resolveTenantFromConfig('woocommerce');
    const result = await ecommerceService.handleOrderCreated(req.body, 'woocommerce', tenantId, req.app.get('io'));
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/woocommerce/order-updated', webhookAuth('woocommerce'), async (req, res) => {
  try {
    const tenantId = await resolveTenantFromConfig('woocommerce');
    const result = await ecommerceService.handleOrderUpdated(req.body, 'woocommerce', tenantId, req.app.get('io'));
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
