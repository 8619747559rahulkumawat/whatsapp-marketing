const Deal = require('../models/Deal');
const Activity = require('../models/Activity');

exports.getDeals = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    if (req.user.role !== 'admin') filter.userId = req.user._id;
    if (req.query.stage) filter.stage = req.query.stage;
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { contactName: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    const deals = await Deal.find(filter)
      .populate('assignedTo', 'name email')
      .sort({ order: 1, createdAt: -1 });
    res.json({ success: true, deals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDeal = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id)
      .populate('assignedTo', 'name email');
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found' });
    res.json({ success: true, deal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createDeal = async (req, res) => {
  try {
    const deal = await Deal.create({
      ...req.body,
      tenantId: req.tenant._id,
      userId: req.user._id
    });
    await Activity.create({
      tenantId: req.tenant._id,
      userId: req.user._id,
      contactId: req.body.contactId,
      dealId: deal._id,
      type: 'deal',
      title: `Deal created: ${deal.title}`,
      description: `New deal worth ₹${deal.value} in ${deal.stage} stage`,
      metadata: { dealId: deal._id, value: deal.value, stage: deal.stage }
    });
    res.status(201).json({ success: true, deal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateDeal = async (req, res) => {
  try {
    const old = await Deal.findById(req.params.id);
    const deal = await Deal.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found' });
    if (old && old.stage !== deal.stage) {
      await Activity.create({
        tenantId: req.tenant._id,
        userId: req.user._id,
        contactId: deal.contactId,
        dealId: deal._id,
        type: 'deal',
        title: `Deal moved to ${deal.stage}`,
        description: `${deal.title} moved from ${old.stage} to ${deal.stage}`,
        metadata: { fromStage: old.stage, toStage: deal.stage }
      });
    }
    res.json({ success: true, deal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteDeal = async (req, res) => {
  try {
    const deal = await Deal.findByIdAndDelete(req.params.id);
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found' });
    res.json({ success: true, message: 'Deal deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateDealStage = async (req, res) => {
  try {
    const { stage, order } = req.body;
    const old = await Deal.findById(req.params.id);
    const deal = await Deal.findByIdAndUpdate(
      req.params.id,
      { stage, order: order || 0, updatedAt: new Date() },
      { new: true }
    );
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found' });
    if (stage === 'won') deal.closedDate = new Date();
    if (stage === 'lost') deal.closedDate = new Date();
    await deal.save();
    if (old && old.stage !== stage) {
      await Activity.create({
        tenantId: req.tenant._id,
        userId: req.user._id,
        contactId: deal.contactId,
        dealId: deal._id,
        type: 'deal',
        title: `Deal moved to ${stage}`,
        description: `${deal.title} moved from ${old.stage} to ${stage}`,
        metadata: { fromStage: old.stage, toStage: stage }
      });
    }
    res.json({ success: true, deal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.reorderDeals = async (req, res) => {
  try {
    const { deals } = req.body;
    const ops = deals.map((d, i) => ({
      updateOne: { filter: { _id: d._id }, update: { order: i, stage: d.stage } }
    }));
    await Deal.bulkWrite(ops);
    res.json({ success: true, message: 'Reordered' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDealStats = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    if (req.user.role !== 'admin') filter.userId = req.user._id;
    const stats = await Deal.aggregate([
      { $match: filter },
      { $group: { _id: '$stage', count: { $sum: 1 }, total: { $sum: '$value' } } }
    ]);
    const totalValue = await Deal.aggregate([
      { $match: { ...filter, stage: { $nin: ['lost'] } } },
      { $group: { _id: null, total: { $sum: '$value' } } }
    ]);
    res.json({
      success: true,
      stageStats: stats,
      totalPipeline: totalValue[0]?.total || 0
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
