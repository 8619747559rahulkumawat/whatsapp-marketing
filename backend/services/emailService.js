let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch { console.warn('[Email] nodemailer not installed - email sending disabled'); }

let transporter = null;

const transporterReady = () => !!transporter;

const initTransporter = () => {
  if (transporter) return Promise.resolve(transporter);
  if (!nodemailer) return Promise.resolve(null);
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Email] SMTP not fully configured (SMTP_HOST, SMTP_USER, SMTP_PASS required)');
    return Promise.resolve(null);
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return transporter.verify().then(() => {
    console.log('[Email] SMTP connection verified');
    return transporter;
  }).catch((err) => {
    console.warn('[Email] SMTP verification failed:', err.message);
    transporter = null;
    return null;
  });
};

// Initialize immediately but don't block
initTransporter();

exports.sendEmail = async ({ to, subject, html, text }) => {
  const transport = await initTransporter();
  if (!transport) {
    console.log('Email not sent - SMTP not configured');
    return { success: false, error: 'SMTP not configured' };
  }
  try {
    const info = await transport.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'RSendix.pro'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text
    });
    console.log('Email sent:', info.messageId);
    return { success: true, info };
  } catch (err) {
    console.error('Email send error:', err.message);
    return { success: false, error: err.message };
  }
};

const emailModule = exports;

exports.sendInvoiceEmail = async (invoice, userEmail) => {
  return emailModule.sendEmail({
    to: userEmail,
    subject: `Invoice ${invoice.invoiceNumber} from RSendix.pro`,
    html: `
      <h2>Invoice #${invoice.invoiceNumber}</h2>
      <p>Amount: ${invoice.currency} ${invoice.amount}</p>
      <p>Status: ${invoice.status}</p>
      <p>Date: ${new Date(invoice.createdAt).toLocaleDateString()}</p>
    `
  });
};

exports.sendSubscriptionConfirmation = async (email, planName) => {
  return emailModule.sendEmail({
    to: email,
    subject: `Subscription Activated - ${planName}`,
    html: `<h2>Welcome to ${planName} Plan!</h2><p>Your subscription is now active.</p>`
  });
};
