const express = require('express');
const router = express.Router();
const emailTemplateController = require('../controllers/emailTemplateController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth, tenantMiddleware);

router.get('/', emailTemplateController.getTemplates);
router.post('/', emailTemplateController.createTemplate);
router.get('/:id', emailTemplateController.getTemplate);
router.put('/:id', emailTemplateController.updateTemplate);
router.delete('/:id', emailTemplateController.deleteTemplate);

module.exports = router;
