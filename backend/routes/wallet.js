const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { auth, adminOnly } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');

router.use(auth, tenantMiddleware);

router.get('/balance', walletController.getBalance);
router.get('/transactions', walletController.getTransactions);
router.post('/add', adminOnly, walletController.addCredits);
router.post('/deduct', adminOnly, walletController.deductCredits);

module.exports = router;
