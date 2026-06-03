const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const ScheduledCampaign = require('../models/ScheduledCampaign');
const Campaign = require('../models/Campaign');
const schedulerService = require('../services/schedulerService');

router.use(auth);
router.use(tenantMiddleware);

router.get('/', async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id, userId: req.user._id };
    const scheduled = await ScheduledCampaign.find(filter)
      .populate('campaignId', 'name type message')
      .sort({ scheduledAt: -1 });
    res.json({ success: true, scheduled });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { campaignId, scheduledAt, scheduleType, timezone, repeatConfig } = req.body;
    const campaign = await Campaign.findOne({ _id: campaignId, tenantId: req.tenant._id });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    const sc = await schedulerService.scheduleCampaign(campaignId, scheduledAt, scheduleType || 'once', timezone || 'Asia/Kolkata', repeatConfig || {});
    res.status(201).json({ success: true, scheduled: sc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const sc = await ScheduledCampaign.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { $set: req.body },
      { new: true }
    );
    if (!sc) return res.status(404).json({ success: false, message: 'Scheduled campaign not found' });
    res.json({ success: true, scheduled: sc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const sc = await ScheduledCampaign.findOneAndDelete({ _id: req.params.id, tenantId: req.tenant._id });
    if (!sc) return res.status(404).json({ success: false, message: 'Scheduled campaign not found' });
    res.json({ success: true, message: 'Scheduled campaign deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const sc = await ScheduledCampaign.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { status: 'cancelled' },
      { new: true }
    );
    if (!sc) return res.status(404).json({ success: false, message: 'Scheduled campaign not found' });
    res.json({ success: true, scheduled: sc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
