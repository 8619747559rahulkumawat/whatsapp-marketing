const Activity = require('../models/Activity');

exports.receiveEmail = async (req, res) => {
  try {
    const { to, from, subject, body, contactEmail } = req.body;
    const Contact = require('../models/Contact');
    const contact = await Contact.findOne({ tenantId: req.tenant._id, email: contactEmail || from });
    await Activity.create({
      tenantId: req.tenant._id, userId: req.user._id,
      contactId: contact?._id,
      type: 'email',
      title: `Email received: ${subject || '(no subject)'}`,
      description: `From: ${from || 'unknown'}`,
      metadata: { to, from, subject, body: body?.substring(0, 1000) }
    });
    res.json({ success: true, message: 'Email captured' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
