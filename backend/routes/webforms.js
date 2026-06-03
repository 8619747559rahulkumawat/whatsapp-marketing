const express = require('express');
const router = express.Router();
const webFormController = require('../controllers/webFormController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth);
router.use(tenantMiddleware);

router.get('/', webFormController.getWebForms);
router.post('/', webFormController.createWebForm);
router.get('/:id', webFormController.getWebForm);
router.put('/:id', webFormController.updateWebForm);
router.delete('/:id', webFormController.deleteWebForm);

// Public route (no auth) for form submission
const publicRouter = express.Router();
publicRouter.get('/:slug', webFormController.getPublicForm);
publicRouter.post('/:slug', webFormController.submitWebForm);

module.exports = router;
module.exports.publicRouter = publicRouter;
