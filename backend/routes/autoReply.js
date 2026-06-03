const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const ctrl = require('../controllers/autoReplyController');

router.use(auth, tenantMiddleware);

router.get('/', ctrl.getRules);
router.post('/', ctrl.createRule);
router.put('/:id', ctrl.updateRule);
router.delete('/:id', ctrl.deleteRule);

module.exports = router;
