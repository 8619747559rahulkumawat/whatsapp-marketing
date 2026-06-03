const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id, userId: req.user._id };
    if (req.query.unread === 'true') filter.read = false;
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(req.query.limit) || 50);
    const unreadCount = await Notification.countDocuments({ ...filter, read: false });
    res.json({ success: true, notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      await Notification.updateMany(
        { tenantId: req.tenant._id, userId: req.user._id },
        { read: true }
      );
    } else {
      await Notification.findByIdAndUpdate(id, { read: true });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createNotification = async (req, res) => {
  try {
    const notification = await Notification.create({
      ...req.body, tenantId: req.tenant._id
    });
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${notification.userId}`).emit('notification:new', notification);
    }
    res.status(201).json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
