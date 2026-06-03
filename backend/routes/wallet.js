const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/balance', auth, walletController.getBalance);
router.get('/transactions', auth, walletController.getTransactions);
router.post('/add', auth, adminOnly, walletController.addCredits);
router.post('/deduct', auth, adminOnly, walletController.deductCredits);

module.exports = router;
