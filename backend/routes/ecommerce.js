const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const WebhookEndpoint = require('../models/WebhookEndpoint');
const AutomationFlow = require('../models/AutomationFlow');

router.get('/settings', auth, tenantMiddleware, async (req, res) => {
  try {
    const webhooks = await WebhookEndpoint.find({
      tenantId: req.tenant._id,
      events: { $regex: 'shopify|woocommerce|ecommerce', $options: 'i' }
    });
    const flows = await AutomationFlow.find({
      tenantId: req.tenant._id,
      'trigger.config.event': { $regex: 'shopify|woocommerce|ecommerce|abandoned_checkout|order', $options: 'i' }
    });
    res.json({
      success: true,
      shopifyConfigured: !!process.env.SHOPIFY_WEBHOOK_SECRET,
      woocommerceConfigured: !!process.env.WOOCOMMERCE_WEBHOOK_SECRET,
      webhookUrl: `${req.protocol}://${req.get('host')}/api/integration`,
      webhooks,
      automationFlows: flows
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/analytics', auth, tenantMiddleware, async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    const [totalFlows, abandonedCarts, orderNotifications] = await Promise.all([
      AutomationFlow.countDocuments({
        ...filter,
        'trigger.config.event': { $regex: 'shopify|woocommerce|ecommerce', $options: 'i' }
      }),
      AutomationFlow.countDocuments({
        ...filter,
        'trigger.config.event': { $regex: 'abandoned_checkout', $options: 'i' }
      }),
      AutomationFlow.countDocuments({
        ...filter,
        'trigger.config.event': { $regex: 'order_created|order_updated', $options: 'i' }
      })
    ]);
    res.json({ success: true, analytics: { totalFlows, abandonedCarts, orderNotifications } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
