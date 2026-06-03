const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth, tenantMiddleware);

router.get('/team', roleController.getTeamMembers);
router.get('/permissions', roleController.getPermissions);
router.put('/:id', roleController.updateUserRole);

module.exports = router;
