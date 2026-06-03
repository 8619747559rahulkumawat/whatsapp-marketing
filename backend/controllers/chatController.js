const Chat = require('../models/Chat');
const User = require('../models/User');
const mongoose = require('mongoose');

exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';

    let userMatch;
    if (isAdmin) {
      userMatch = { waPhone: '' };
    } else {
      userMatch = { $or: [{ senderId: userId }, { receiverId: userId }], waPhone: '' };
    }

    const userConversations = await Chat.aggregate([
      { $match: userMatch },
      { $sort: { createdAt: -1 } },
      {
        $addFields: {
          otherUserId: {
            $cond: [
              { $eq: ['$senderId', userId] },
              { $ifNull: ['$receiverId', '$senderId'] },
              '$senderId'
            ]
          }
        }
      },
      { $group: { _id: '$otherUserId', messages: { $push: '$$ROOT' }, lastMsg: { $first: '$message' }, lastTime: { $first: '$createdAt' } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $sort: { lastTime: -1 } }
    ]);

    let waMatch;
    if (isAdmin) {
      waMatch = { waPhone: { $exists: true, $nin: ['', null] } };
    } else {
      waMatch = { waPhone: { $exists: true, $nin: ['', null] }, $or: [{ senderId: userId }, { receiverId: userId }] };
    }

    const waConversations = await Chat.aggregate([
      { $match: waMatch },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$waPhone',
          messages: { $push: '$$ROOT' },
          lastMsg: { $first: '$message' },
          lastTime: { $first: '$createdAt' },
          waPhone: { $first: '$waPhone' },
          waName: { $first: '$waName' },
          profilePic: { $first: '$profilePic' }
        }
      },
      { $sort: { lastTime: -1 } }
    ]);
    const conversations = [
      ...userConversations,
      ...waConversations.map(c => {
        let p = c.waPhone;
        if (p && p.startsWith('91') && p.length > 10) p = p.slice(2);
        let contactName = c.waName || p;
        if (contactName === c.waPhone || contactName === p || /^\d+$/.test(contactName)) contactName = p;
        return {
          ...c,
          _id: 'wa_' + p,
          fullPhone: c.waPhone,
          profilePic: c.profilePic || '',
          user: { _id: 'wa_' + p, name: contactName, phone: p, role: 'user', profilePic: c.profilePic || '' }
        };
      })
    ];
    conversations.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
    res.json({ success: true, conversations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { message, receiverId, mediaUrl, mediaType } = req.body;
    if (!message && !mediaUrl) return res.status(400).json({ success: false, message: 'Message or media required' });

    let targetId = receiverId;

    if (!targetId && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      const admin = await User.findOne({ $or: [{ role: 'admin' }, { role: 'super_admin' }] }).sort({ createdAt: 1 });
      if (admin) targetId = admin._id;
    }

    const fileType = mediaType || (mediaUrl ? 'image' : 'text');
    let displayMessage = message;
    if (!displayMessage) {
      if (fileType === 'image') displayMessage = '📷 Photo';
      else if (fileType === 'video') displayMessage = '🎬 Video';
      else if (fileType === 'audio') displayMessage = '🎵 Voice';
      else if (fileType === 'document') displayMessage = '📎 Document';
      else displayMessage = '📎 File';
    }

    const chat = await Chat.create({
      senderId: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      receiverId: targetId,
      message: displayMessage,
      mediaUrl: mediaUrl || '',
      mediaType: fileType,
      waPhone: '',
      tenantId: req.user.tenantId,
      timestamp: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      const userId = req.user._id.toString();
      io.to(`user_${userId}`).emit('chat:new', chat);
      if (targetId) io.to(`user_${targetId}`).emit('chat:new', chat);
      io.to('admin_room').emit('chat:new', chat);
    }

    res.status(201).json({ success: true, chat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteConversation = async (req, res) => {
  try {
    const userId = req.user._id;
    const targetUserId = req.params.userId;

    // Handle WhatsApp number conversations (wa_ prefix)
    if (targetUserId?.startsWith('wa_')) {
      const rawPhone = targetUserId.replace('wa_', '').replace(/[^0-9]/g, '');
      const phone = rawPhone.startsWith('91') ? rawPhone : '91' + rawPhone;
      const Message = require('../models/Message');
      // Delete from Message collection by exact phone match
      await Message.deleteMany({ to: phone, userId: userId });
      await Message.deleteMany({ to: rawPhone.replace(/^91/, ''), userId: userId });
      // Delete from Chat collection by waPhone field
      await Chat.deleteMany({ waPhone: { $in: [phone, rawPhone] }, $or: [{ senderId: userId }, { receiverId: userId }] });
      return res.json({ success: true, message: 'WhatsApp conversation deleted' });
    }

    // Handle in-app chat users
    await Chat.deleteMany({
      $or: [
        { senderId: userId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: userId }
      ]
    });
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    let msg = await Chat.findOne({ _id: id, $or: [{ senderId: req.user._id }, { receiverId: req.user._id }] });
    if (msg) {
      msg.message = '[Deleted]';
      await msg.save();
      return res.json({ success: true, message: 'Message deleted' });
    }
    const Message = require('../models/Message');
    const sentMsg = await Message.findOne({ _id: id });
    if (sentMsg) {
      sentMsg.content = '[Deleted]';
      await sentMsg.save();
      return res.json({ success: true, message: 'Message deleted' });
    }
    return res.status(404).json({ success: false, message: 'Message not found or unauthorized' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get support messages for current user or a specific user (admin)
exports.getSupportMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    const targetUserId = req.query.userId || userId;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    if (!isAdmin && String(targetUserId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const targetObjectId = new mongoose.Types.ObjectId(targetUserId);
    const filter = {
      $and: [
        { $or: [{ senderId: targetObjectId }, { receiverId: targetObjectId }] },
        { $or: [{ waPhone: '' }, { waPhone: { $exists: false } }, { waPhone: null }] }
      ]
    };

    const messages = await Chat.find(filter)
      .sort({ createdAt: 1 })
      .limit(1000)
      .lean();

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all users with support conversations (admin only)
exports.getSupportUsers = async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));

    const adminId = req.user._id;
    const chatFilter = { $or: [{ waPhone: '' }, { waPhone: { $exists: false } }, { waPhone: null }] };

    const userConversations = await Chat.aggregate([
      { $match: chatFilter },
      { $sort: { createdAt: -1 } },
      {
        $addFields: {
          participantId: {
            $cond: [
              { $eq: ['$senderId', adminId] },
              '$receiverId',
              '$senderId'
            ]
          }
        }
      },
      { $match: { participantId: { $exists: true, $nin: [null, adminId] } } },
      {
        $group: {
          _id: '$participantId',
          lastTime: { $first: '$createdAt' },
          lastMessage: { $first: '$message' }
        }
      },
      { $sort: { lastTime: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: '$_id',
          name: { $ifNull: ['$user.name', 'Unknown'] },
          email: { $ifNull: ['$user.email', ''] },
          lastMessage: 1,
          lastTime: 1
        }
      }
    ]);

    const totalResult = await Chat.aggregate([
      { $match: chatFilter },
      {
        $addFields: {
          participantId: {
            $cond: [
              { $eq: ['$senderId', adminId] },
              '$receiverId',
              '$senderId'
            ]
          }
        }
      },
      { $match: { participantId: { $exists: true, $nin: [null, adminId] } } },
      { $group: { _id: '$participantId' } },
      { $count: 'total' }
    ]);

    const total = totalResult[0]?.total || 0;

    res.json({
      success: true,
      users: userConversations,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId?.startsWith('wa_')) {
      const phone = userId.replace('wa_', '');
      await Chat.updateMany(
        { waPhone: { $regex: phone, $options: 'i' }, senderRole: 'user', read: false },
        { read: true }
      );
    } else {
      await Chat.updateMany(
        { senderId: userId, receiverId: req.user._id, read: false },
        { read: true }
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateMessageRead = async (req, res) => {
  try {
    const { id } = req.params;
    const read = req.body.read !== false;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid message id' });
    }

    const query = { _id: id };
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      query.$or = [{ senderId: req.user._id }, { receiverId: req.user._id }];
    }

    const chat = await Chat.findOneAndUpdate(query, { read }, { new: true });
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to('admin_room').emit('chat:read:update', { messageId: chat._id, read });
      if (chat.senderId) io.to(`user_${chat.senderId}`).emit('chat:read:update', { messageId: chat._id, read });
      if (chat.receiverId) io.to(`user_${chat.receiverId}`).emit('chat:read:update', { messageId: chat._id, read });
    }

    res.json({ success: true, message: chat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
