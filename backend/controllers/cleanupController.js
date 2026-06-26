const Contact = require('../models/Contact');
const Session = require('../models/Session');
const whatsappService = require('../services/whatsappService');

exports.cleanupInactive = async (req, res) => {
  try {
    const { sessionId, daysInactive = 30 } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId required' });

    const PAGE_SIZE = 100;
    const totalContacts = await Contact.countDocuments({ tenantId: req.tenant._id });
    const sock = whatsappService.sessions.get(sessionId);
    if (!sock) return res.status(400).json({ success: false, message: 'Session not connected' });

    const results = { total: 0, active: 0, inactive: 0, removed: 0, errors: [] };

    let page = 0;
    while (page * PAGE_SIZE < totalContacts) {
      const contacts = await Contact.find({ tenantId: req.tenant._id })
        .skip(page * PAGE_SIZE).limit(PAGE_SIZE);
      page++;
      for (const contact of contacts) {
        if (!contact.phone) { results.errors.push('null phone skipped'); continue; }
        results.total++;
        try {
          const phone = contact.phone.replace(/[^0-9]/g, '');
          const data = await sock.onWhatsApp(phone);
          const exists = data && data[0]?.jid;
          if (exists) {
            results.active++;
          } else {
            const cutoff = new Date(Date.now() - daysInactive * 86400000);
            if (!contact.lastMessaged || contact.lastMessaged < cutoff) {
              await Contact.findByIdAndDelete(contact._id);
              results.removed++;
            } else {
              results.inactive++;
            }
          }
        } catch (err) {
          results.errors.push(`${contact.phone}: ${err.message}`);
        }
      }
    }

    res.json({ success: true, ...results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.checkNumbers = async (req, res) => {
  try {
    const { sessionId, numbers } = req.body;
    if (!sessionId || !numbers?.length) return res.status(400).json({ success: false, message: 'sessionId and numbers required' });

    const sock = whatsappService.sessions.get(sessionId);
    if (!sock) return res.status(400).json({ success: false, message: 'Session not connected' });

    const results = [];
    for (const num of numbers) {
      try {
        const phone = num.replace(/[^0-9]/g, '');
        const data = await sock.onWhatsApp(phone);
        results.push({ number: num, exists: !!(data && data[0]?.jid) });
      } catch (err) {
        results.push({ number: num, exists: false, error: err.message });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
