const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth, tenantMiddleware);

router.get('/', webhookController.getWebhooks);
router.post('/', webhookController.createWebhook);
router.put('/:id', webhookController.updateWebhook);
router.delete('/:id', webhookController.deleteWebhook);
router.post('/:id/test', webhookController.testWebhook);

module.exports = router;
