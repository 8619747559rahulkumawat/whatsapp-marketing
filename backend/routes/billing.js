const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const { checkPermission } = require('../middleware/rbac');

router.use(auth);
router.use(tenantMiddleware);

router.get('/plans', billingController.getPlans);
router.post('/plans', checkPermission('manage_billing'), billingController.createPlan);
router.put('/plans/:id', checkPermission('manage_billing'), billingController.updatePlan);
router.delete('/plans/:id', checkPermission('manage_billing'), billingController.deletePlan);

router.get('/invoices', billingController.getInvoices);
router.post('/invoices', checkPermission('manage_billing'), billingController.createInvoice);
router.get('/all-invoices', checkPermission('manage_billing'), billingController.getAllInvoices);

router.get('/rate', billingController.getCreditRate);
router.post('/razorpay/create-order', billingController.createRazorpayOrder);
router.post('/razorpay/verify', billingController.verifyRazorpayPayment);
router.post('/stripe/create-payment-intent', billingController.createStripePaymentIntent);
router.post('/stripe/confirm', billingController.confirmStripePayment);

router.post('/subscribe', billingController.subscribeToPlan);
router.post('/subscribe/confirm', billingController.confirmPlanSubscription);

module.exports = router;
