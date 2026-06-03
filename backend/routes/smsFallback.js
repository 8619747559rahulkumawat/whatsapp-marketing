const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const SmsFallbackLog = require('../models/SmsFallbackLog');
const smsFallbackService = require('../services/smsFallbackService');

router.use(auth);
router.use(tenantMiddleware);

router.get('/logs', async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id, userId: req.user._id };
    const logs = await SmsFallbackLog.find(filter).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id, userId: req.user._id };
    const [total, sent, failed, totalCost] = await Promise.all([
      SmsFallbackLog.countDocuments(filter),
      SmsFallbackLog.countDocuments({ ...filter, smsStatus: 'sent' }),
      SmsFallbackLog.countDocuments({ ...filter, smsStatus: 'failed' }),
      SmsFallbackLog.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$cost' } } }
      ])
    ]);
    res.json({ success: true, stats: { total, sent, failed, totalCost: totalCost[0]?.total || 0 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/test', async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ success: false, message: 'Phone and message required' });
    const result = await smsFallbackService.executeSmsFallback(
      { _id: 'test', to, content: message },
      req.tenant._id, req.user._id
    );
    res.json({ success: result.success, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
