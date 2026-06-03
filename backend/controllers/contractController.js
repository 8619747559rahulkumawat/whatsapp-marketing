const Contract = require('../models/Contract');
const Activity = require('../models/Activity');

exports.getContracts = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.user.role !== 'admin') filter.userId = req.user._id;
    const contracts = await Contract.find(filter).populate('contactId', 'name phone').sort({ createdAt: -1 });
    res.json({ success: true, contracts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getContract = async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id).populate('contactId', 'name phone');
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });
    res.json({ success: true, contract });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createContract = async (req, res) => {
  try {
    const contract = await Contract.create({
      ...req.body, tenantId: req.tenant._id, userId: req.user._id
    });
    await Activity.create({
      tenantId: req.tenant._id, userId: req.user._id,
      contactId: req.body.contactId, dealId: req.body.dealId,
      type: 'system', title: `Contract created: ${contract.title}`,
      metadata: { contractId: contract._id }
    });
    res.status(201).json({ success: true, contract });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateContract = async (req, res) => {
  try {
    const contract = await Contract.findByIdAndUpdate(
      req.params.id, { ...req.body, updatedAt: new Date() }, { new: true }
    );
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });
    res.json({ success: true, contract });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteContract = async (req, res) => {
  try {
    await Contract.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Contract deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
