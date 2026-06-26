const Task = require('../models/Task');
const Activity = require('../models/Activity');

exports.getTasks = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
    if (req.query.contactId) filter.contactId = req.query.contactId;
    if (req.user.role !== 'admin') filter.userId = req.user._id;
    const tasks = await Task.find(filter)
      .populate('assignedTo', 'name email')
      .populate('contactId', 'name phone')
      .sort({ dueDate: 1, priority: -1 });
    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTask = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, tenantId: req.tenant._id })
      .populate('assignedTo', 'name email')
      .populate('contactId', 'name phone');
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createTask = async (req, res) => {
  try {
    const task = await Task.create({
      ...req.body,
      tenantId: req.tenant._id,
      userId: req.user._id
    });
    await Activity.create({
      tenantId: req.tenant._id,
      userId: req.user._id,
      contactId: req.body.contactId,
      dealId: req.body.dealId,
      type: 'task',
      title: `Task created: ${task.title}`,
      metadata: { taskId: task._id, priority: task.priority, dueDate: task.dueDate }
    });
    res.status(201).json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const data = { ...req.body, updatedAt: new Date() };
    if (req.body.status === 'completed') data.completedAt = new Date();
    const task = await Task.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenant._id }, data, { new: true });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, tenantId: req.tenant._id });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTaskStats = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    if (req.user.role !== 'admin') filter.userId = req.user._id;
    const stats = await Task.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const overdue = await Task.countDocuments({ ...filter, dueDate: { $lt: new Date() }, status: { $ne: 'completed' } });
    const dueToday = await Task.countDocuments({
      ...filter,
      dueDate: { $gte: new Date().setHours(0,0,0,0), $lte: new Date().setHours(23,59,59,999) },
      status: { $ne: 'completed' }
    });
    res.json({ success: true, stats, overdue, dueToday });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
