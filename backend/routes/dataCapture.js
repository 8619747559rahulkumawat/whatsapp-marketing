const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const Contact = require('../models/Contact');
const dataCaptureService = require('../services/dataCaptureService');

router.use(auth);
router.use(tenantMiddleware);

router.post('/extract', async (req, res) => {
  try {
    const { message, contactId } = req.body;
    if (!message || !contactId) return res.status(400).json({ success: false, message: 'Message and contactId required' });
    const result = await dataCaptureService.captureEntity(message, contactId, req.tenant._id, req.user._id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/history/:contactId', async (req, res) => {
  try {
    const contact = await Contact.findOne({
      _id: req.params.contactId,
      tenantId: req.tenant._id
    }).select('name phone email address variables');
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, contact, capturedData: contact.variables || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    const totalWithData = await Contact.countDocuments({
      ...filter,
      $or: [
        { email: { $exists: true, $ne: '' } },
        { address: { $exists: true, $ne: '' } },
        { 'variables.lastOrderId': { $exists: true } }
      ]
    });
    const totalContacts = await Contact.countDocuments(filter);
    res.json({
      success: true,
      stats: {
        totalContacts,
      totalWithData,
        captureRate: totalContacts > 0 ? Math.round((totalWithData / totalContacts) * 100) : 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
