const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const { uploadWithCompression } = require('../middleware/upload');
const ctrl = require('../controllers/importController');

router.use(auth, tenantMiddleware);

router.post('/', uploadWithCompression('file'), ctrl.importContacts);

module.exports = router;
