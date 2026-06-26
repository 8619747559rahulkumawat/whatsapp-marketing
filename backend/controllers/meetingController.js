const Meeting = require('../models/Meeting');
const Activity = require('../models/Activity');

exports.getMeetings = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.contactId) filter.contactId = req.query.contactId;
    if (req.user.role !== 'admin') filter.userId = req.user._id;
    const meetings = await Meeting.find(filter)
      .populate('contactId', 'name phone')
      .sort({ startTime: -1 });
    res.json({ success: true, meetings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ _id: req.params.id, tenantId: req.tenant._id });
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });
    res.json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createMeeting = async (req, res) => {
  try {
    const data = { ...req.body, tenantId: req.tenant._id, userId: req.user._id };
    if (data.startTime && !data.endTime) {
      data.endTime = new Date(new Date(data.startTime).getTime() + (data.duration || 30) * 60000);
    }
    const meeting = await Meeting.create(data);
    await Activity.create({
      tenantId: req.tenant._id,
      userId: req.user._id,
      contactId: req.body.contactId,
      dealId: req.body.dealId,
      type: 'meeting',
      title: `Meeting scheduled: ${meeting.title}`,
      description: `${meeting.title} on ${new Date(meeting.startTime).toLocaleString()}`,
      metadata: { meetingId: meeting._id, startTime: meeting.startTime, type: meeting.type }
    });
    res.status(201).json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateMeeting = async (req, res) => {
  try {
    const data = { ...req.body, updatedAt: new Date() };
    if (data.startTime && !data.endTime) {
      data.endTime = new Date(new Date(data.startTime).getTime() + (data.duration || 30) * 60000);
    }
    const meeting = await Meeting.findOneAndUpdate({ _id: req.params.id, tenantId: req.tenant._id }, data, { new: true });
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });
    res.json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findOneAndDelete({ _id: req.params.id, tenantId: req.tenant._id });
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });
    res.json({ success: true, message: 'Meeting deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
