const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { auth, adminOnly } = require('../middleware/auth');

router.put('/my-credits', auth, adminOnly, adminController.updateMyCredits);
router.post('/users', auth, adminOnly, adminController.createUser);
router.get('/dashboard', auth, adminOnly, adminController.getAdminDashboard);
router.get('/users', auth, adminOnly, adminController.getUsers);
router.put('/users/:id', auth, adminOnly, adminController.updateUser);
router.delete('/users/:id', auth, adminOnly, adminController.deleteUser);
router.get('/settings', auth, adminOnly, adminController.getSettings);
router.put('/settings', auth, adminOnly, adminController.updateSetting);
router.get('/transactions', auth, adminOnly, adminController.getAllTransactions);
router.put('/users/:id/plan', auth, adminOnly, adminController.updateUserPlan);
router.get('/subscriptions', auth, adminOnly, adminController.getSubscriptions);
router.get('/subscriptions/stats', auth, adminOnly, adminController.getSubscriptionStats);

module.exports = router;
