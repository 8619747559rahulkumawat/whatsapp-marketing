const Razorpay = require('razorpay');
const Stripe = require('stripe');
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Setting = require('../models/Setting');

let razorpayInstance = null;
let stripeInstance = null;

const getRazorpayInstance = () => {
  if (!razorpayInstance) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (keyId && keySecret) {
      razorpayInstance = new Razorpay({ key_id: keyId, key_secret: keySecret });
    }
  }
  return razorpayInstance;
};

const getStripeInstance = () => {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (secretKey) {
      stripeInstance = new Stripe(secretKey);
    }
  }
  return stripeInstance;
};

exports.createRazorpayOrder = async (amount, currency = 'INR', receipt) => {
  const razorpay = getRazorpayInstance();
  if (!razorpay) throw new Error('Razorpay not configured');
  const options = {
    amount: amount * 100,
    currency,
    receipt: receipt || `receipt_${Date.now()}`,
    payment_capture: 1
  };
  return razorpay.orders.create(options);
};

exports.verifyRazorpayPayment = (orderId, paymentId, signature) => {
  const razorpay = getRazorpayInstance();
  if (!razorpay) throw new Error('Razorpay not configured');
  const crypto = require('crypto');
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  if (expectedSig.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature));
};

exports.createStripePaymentIntent = async (amount, currency = 'usd') => {
  const stripe = getStripeInstance();
  if (!stripe) throw new Error('Stripe not configured');
  return stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency,
    automatic_payment_methods: { enabled: true }
  });
};

exports.generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const db = mongoose.connection.db;
  const counters = db.collection('counters');
  const result = await counters.findOneAndUpdate(
    { name: `invoice_${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const seq = (result && result.seq) || 1;
  return `INV-${year}-${String(seq).padStart(6, '0')}`;
};

exports.createInvoice = async ({ tenantId, userId, amount, currency, items, billingDetails, planId }) => {
  const invoiceNumber = await this.generateInvoiceNumber();
  return Invoice.create({
    tenantId,
    userId,
    invoiceNumber,
    planId,
    amount,
    currency: currency || 'INR',
    items: items || [{ description: 'Credits', quantity: 1, unitPrice: amount, total: amount }],
    billingDetails: billingDetails || {},
    status: 'draft'
  });
};

exports.processCreditPurchase = async ({ userId, amount, credits, paymentMethod, paymentId, invoiceId }) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error('User not found');

    const balanceBefore = user.credits;
    const updated = await User.findByIdAndUpdate(userId,
      { $inc: { credits } },
      { new: true, session }
    );

    await Transaction.create([{
      userId: user._id,
      tenantId: user.tenantId,
      type: 'credit',
      amount: credits,
      balanceBefore,
      balanceAfter: updated.credits,
      description: `Purchased ${credits} credits via ${paymentMethod}`,
      paymentMethod,
      status: 'completed'
    }], { session });

    if (invoiceId) {
      await Invoice.findByIdAndUpdate(invoiceId, {
        status: 'paid',
        paidAt: new Date(),
        paymentMethod,
        paymentId
      }, { session });
    }

    await session.commitTransaction();
    return { balance: updated.credits, credits };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

exports.getCreditRate = async () => {
  const setting = await Setting.findOne({ key: 'creditRate' });
  return setting ? parseFloat(setting.value) : 0.15;
};

exports.calculateCreditsForAmount = async (amount) => {
  const rate = await this.getCreditRate();
  return Math.floor(amount / rate);
};

exports.getSubscriptionPlans = async () => {
  const SubscriptionPlan = require('../models/SubscriptionPlan');
  return SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
};
