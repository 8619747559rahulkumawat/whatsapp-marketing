const Activity = require('../models/Activity');
const Setting = require('../models/Setting');
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

const encrypt = (text) => {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decrypt = (text) => {
  if (!text || !text.includes(':')) return text;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = parts.join(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch { return text; }
};

exports.sendEmail = async (req, res) => {
  try {
    const { to, subject, body, contactId, dealId } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({ success: false, message: 'to, subject, and body required' });
    }
    let sgMail;
    try {
      sgMail = require('@sendgrid/mail');
    } catch {
      return res.status(500).json({ success: false, message: 'SendGrid not installed. Run: npm install @sendgrid/mail' });
    }
    const settings = await Setting.findOne({ tenantId: req.tenant._id, key: 'sendgrid' });
    const apiKey = decrypt(settings?.value?.apiKey) || process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'SendGrid API key not configured. Set SENDGRID_API_KEY in .env or Settings.' });
    }
    sgMail.setApiKey(apiKey);
    const fromEmail = settings?.value?.fromEmail || process.env.SENDGRID_FROM_EMAIL || 'noreply@rsendix.pro';
    const fromName = settings?.value?.fromName || 'RSendix CRM';
    const msg = {
      to, from: { email: fromEmail, name: fromName },
      subject, text: body, html: body.replace(/\n/g, '<br/>')
    };
    await sgMail.send(msg);
    if (contactId) {
      await Activity.create({
        tenantId: req.tenant._id,
        userId: req.user._id,
        contactId,
        dealId,
        type: 'email',
        title: `Email sent: ${subject}`,
        description: `To: ${to}`,
        metadata: { subject, to }
      });
    }
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.saveSettings = async (req, res) => {
  try {
    const { apiKey, fromEmail, fromName } = req.body;
    await Setting.findOneAndUpdate(
      { tenantId: req.tenant._id, key: 'sendgrid' },
      { value: { apiKey: apiKey ? encrypt(apiKey) : undefined, fromEmail, fromName } },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: 'Email settings saved' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSettings = async (req, res) => {
  try {
    const settings = await Setting.findOne({ tenantId: req.tenant._id, key: 'sendgrid' });
    const value = settings?.value || {};
    if (value.apiKey) value.apiKey = value.apiKey ? '••••••' + value.apiKey.slice(-4) : '';
    res.json({ success: true, settings: value });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
