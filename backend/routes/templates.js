const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
// Apply auth and tenant middleware to all routes
router.use(auth);
router.use(tenantMiddleware);

// Specific routes must come before /:id wildcard
router.get('/categories/list', templateController.getCategories);
router.get('/status/:status', templateController.getTemplatesByStatus);

// Template CRUD routes
router.get('/', templateController.getTemplates);
router.post('/', templateController.createTemplate);
router.get('/:id', templateController.getTemplate);
router.put('/:id', templateController.updateTemplate);
router.delete('/:id', templateController.deleteTemplate);

// Template management routes
router.post('/:id/submit-for-approval', templateController.submitForApproval);
router.post('/:id/approve', templateController.approveTemplate);
router.post('/:id/reject', templateController.rejectTemplate);

module.exports = router;