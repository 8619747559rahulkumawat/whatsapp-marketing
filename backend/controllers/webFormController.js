const WebForm = require('../models/WebForm');
const Contact = require('../models/Contact');
const Activity = require('../models/Activity');

exports.getWebForms = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    if (req.user.role !== 'admin') filter.userId = req.user._id;
    const forms = await WebForm.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, forms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getWebForm = async (req, res) => {
  try {
    const form = await WebForm.findOne({ _id: req.params.id, tenantId: req.tenant._id });
    if (!form) return res.status(404).json({ success: false, message: 'Web form not found' });
    res.json({ success: true, form });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createWebForm = async (req, res) => {
  try {
    const form = await WebForm.create({
      ...req.body,
      tenantId: req.tenant._id,
      userId: req.user._id
    });
    res.status(201).json({ success: true, form });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateWebForm = async (req, res) => {
  try {
    const form = await WebForm.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!form) return res.status(404).json({ success: false, message: 'Web form not found' });
    res.json({ success: true, form });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteWebForm = async (req, res) => {
  try {
    const form = await WebForm.findOneAndDelete({ _id: req.params.id, tenantId: req.tenant._id });
    if (!form) return res.status(404).json({ success: false, message: 'Web form not found' });
    res.json({ success: true, message: 'Web form deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitWebForm = async (req, res) => {
  try {
    const form = await WebForm.findOne({ slug: req.params.slug, isActive: true });
    if (!form) return res.status(404).json({ success: false, message: 'Form not found or inactive' });
    const submissionData = req.body;
    const phone = submissionData.phone || submissionData.mobile || '';
    const email = submissionData.email || '';
    const name = submissionData.name || submissionData.fullName || submissionData.firstName || 'Web Lead';
    const user = await require('../models/User').findOne({ tenantId: form.tenantId, role: 'admin' });
    if (user) {
      try {
        await Contact.create({
          tenantId: form.tenantId,
          userId: user._id,
          phone: phone.replace(/[^0-9]/g, ''),
          name,
          email,
          source: 'web_form',
          customFields: { formSlug: form.slug, formName: form.name, submittedData: submissionData }
        });
        await Activity.create({
          tenantId: form.tenantId,
          userId: user._id,
          type: 'system',
          title: `Web form submission: ${form.name}`,
          description: `New lead from ${form.name}: ${name} (${email || phone})`,
          metadata: { formSlug: form.slug, formName: form.name, submission: submissionData }
        });
      } catch (e) { console.error('Webform submission error:', e); }
    }
    await WebForm.findByIdAndUpdate(form._id, { $inc: { submissions: 1 } });
    res.json({ success: true, message: form.successMessage, redirectUrl: form.redirectUrl || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPublicForm = async (req, res) => {
  try {
    const form = await WebForm.findOne({ slug: req.params.slug, isActive: true });
    if (!form) return res.status(404).json({ success: false, message: 'Form not found' });
    res.json({ success: true, form });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
