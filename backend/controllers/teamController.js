const TeamMember = require('../models/TeamMember');
const User = require('../models/User');
const Chat = require('../models/Chat');
const { calculatePagination } = require('../utils/helpers');

exports.getTeamMembers = async (req, res) => {
  try {
    const { skip, limit, page } = calculatePagination(req.query.page, req.query.limit);
    const filter = { tenantId: req.tenant._id };
    const [members, totalCount] = await Promise.all([
      TeamMember.find(filter)
        .populate('userId', 'name email phone role isActive')
        .populate('addedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      TeamMember.countDocuments(filter)
    ]);
    res.json({ success: true, members, pagination: { page, limit, total: totalCount, pages: Math.ceil(totalCount / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addTeamMember = async (req, res) => {
  try {
    const { userId, role, permissions } = req.body;
    const user = await User.findOne({ _id: userId, tenantId: req.tenant._id });
    if (!user) return res.status(404).json({ success: false, message: 'User not found in this tenant' });
    const existing = await TeamMember.findOne({ tenantId: req.tenant._id, userId });
    if (existing) return res.status(400).json({ success: false, message: 'User is already a team member' });
    const member = await TeamMember.create({
      tenantId: req.tenant._id,
      userId,
      addedBy: req.user._id,
      role: role || 'agent',
      permissions: permissions || []
    });
    const populated = await TeamMember.findById(member._id)
      .populate('userId', 'name email phone role')
      .populate('addedBy', 'name email');
    res.status(201).json({ success: true, member: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateTeamMember = async (req, res) => {
  try {
    const { role, permissions, isActive } = req.body;
    const member = await TeamMember.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { $set: { role, permissions, isActive } },
      { new: true }
    ).populate('userId', 'name email phone role');
    if (!member) return res.status(404).json({ success: false, message: 'Team member not found' });
    res.json({ success: true, member });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.removeTeamMember = async (req, res) => {
  try {
    const member = await TeamMember.findOneAndDelete({ _id: req.params.id, tenantId: req.tenant._id });
    if (!member) return res.status(404).json({ success: false, message: 'Team member not found' });
    res.json({ success: true, message: 'Team member removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.assignChat = async (req, res) => {
  try {
    const { chatId, memberId } = req.body;
    const member = await TeamMember.findOne({ _id: memberId, tenantId: req.tenant._id });
    if (!member) return res.status(404).json({ success: false, message: 'Team member not found' });
    await Chat.findByIdAndUpdate(chatId, { assignedTo: memberId });
    await TeamMember.findByIdAndUpdate(memberId, { $addToSet: { assignedChats: chatId } });
    res.json({ success: true, message: 'Chat assigned' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addInternalNote = async (req, res) => {
  try {
    const { chatId, note } = req.body;
    const chat = await Chat.findOneAndUpdate(
      { _id: chatId },
      { $push: { internalNotes: { text: note, addedBy: req.user._id, addedAt: new Date() } } },
      { new: true }
    );
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
    res.json({ success: true, chat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSharedInbox = async (req, res) => {
  try {
    const { skip, limit, page } = calculatePagination(req.query.page, req.query.limit);
    const filter = { tenantId: req.tenant._id };
    const [chats, totalCount] = await Promise.all([
      Chat.find(filter)
        .populate('senderId', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Chat.countDocuments(filter)
    ]);
    res.json({ success: true, chats, pagination: { page, limit, total: totalCount, pages: Math.ceil(totalCount / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
