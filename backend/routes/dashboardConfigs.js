const express = require('express');
const router = express.Router();
const dashboardConfigController = require('../controllers/dashboardConfigController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth, tenantMiddleware);

router.get('/', dashboardConfigController.getConfigs);
router.post('/', dashboardConfigController.createConfig);
router.put('/:id', dashboardConfigController.updateConfig);
router.delete('/:id', dashboardConfigController.deleteConfig);
router.post('/:id/default', dashboardConfigController.setDefault);

module.exports = router;
