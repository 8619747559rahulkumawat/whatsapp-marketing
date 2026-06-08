const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const { auth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const whatsappService = require('../services/whatsappService');

router.use(auth);
router.use(tenantMiddleware);

router.get('/', sessionController.getSessions);
router.post('/', sessionController.createSession);
router.get('/:id/qr', sessionController.getSessionQr);
router.get('/:id/status', sessionController.getSessionStatus);
router.get('/:id/groups', sessionController.getGroups);
router.post('/:id/disconnect', sessionController.disconnectSession);
router.post('/:id/reconnect', sessionController.reconnectSession);
router.delete('/:id', sessionController.deleteSession);
router.post('/:id/pairing-code', sessionController.pairingCode);

router.get('/:id/diagnostics', sessionController.getSessionDiagnostics);
router.get('/:id/contacts/export', sessionController.exportContacts);
router.get('/:id/contacts/export/:format', sessionController.exportContacts);
router.get('/:id/chat/:jid', sessionController.getContactChat);
router.get('/:id/profile/:phone', auth, async (req, res) => {
  try {
    const { id, phone } = req.params;
    const [profilePic, contactName] = await Promise.all([
      whatsappService.fetchProfilePic(id, phone),
      whatsappService.fetchContactName(id, phone)
    ]);
    if (profilePic || contactName) {
      const cleanPhone = phone.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
      const Chat = require('../models/Chat');
      const updateData = {};
      if (profilePic) updateData.profilePic = profilePic;
      if (contactName) updateData.waName = contactName;
      if (Object.keys(updateData).length) {
        await Chat.updateOne(
          { waPhone: cleanPhone },
          { $set: updateData },
          { upsert: true }
        );
      }
    }
    res.json({ success: true, profilePic, contactName });
  } catch (err) {
    res.json({ success: false, message: err.message, profilePic: '', contactName: '' });
  }
});

module.exports = router;
