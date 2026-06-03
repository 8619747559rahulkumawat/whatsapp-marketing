const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');
const { auth } = require('../middleware/auth');
const { checkCredits } = require('../middleware/rbac');

router.get('/keys', auth, apiController.getApiKeys);
router.post('/keys', auth, apiController.createApiKey);
router.delete('/keys/:id', auth, apiController.deleteApiKey);

router.post('/send', apiController.validateApiKey, checkCredits, apiController.apiSendMessage);
router.post('/send-bulk', apiController.validateApiKey, checkCredits, apiController.apiSendBulk);
router.post('/contacts', apiController.validateApiKey, apiController.apiCreateContact);
router.get('/reports', apiController.validateApiKey, apiController.apiGetReports);
router.post('/webhook', apiController.validateApiKey, apiController.apiWebhook);

module.exports = router;
