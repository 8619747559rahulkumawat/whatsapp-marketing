const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const ctrl = require('../controllers/previewController');

router.post('/message', auth, ctrl.previewMessage);

module.exports = router;
