const SupportTicket = require('../models/SupportTicket');
const TeamInbox = require('../models/TeamInbox');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const { calculatePagination } = require('../utils/helpers');

exports.getTickets = async (req, res) => {
  try {
    const { skip, limit, page } = calculatePagination(req.query.page, req.query.limit);
    const filter = { tenantId: req.tenant._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.scope === 'my') filter.assignedTo = req.user._id;
    const [tickets, totalCount] = await Promise.all([
      SupportTicket.find(filter)
        .populate('userId', 'name email phone')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SupportTicket.countDocuments(filter)
    ]);
    res.json({ success: true, tickets, pagination: { page, limit, total: totalCount, pages: Math.ceil(totalCount / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createTicket = async (req, res) => {
  try {
    const { subject, description, priority, chatId } = req.body;
    const ticket = await SupportTicket.create({
      tenantId: req.tenant._id,
      userId: req.user._id,
      subject, description,
      priority: priority || 'medium',
      chatId: chatId || null,
      status: 'open'
    });
    res.status(201).json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateTicketStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const update = { status };
    if (status === 'resolved') {
      update.resolvedAt = new Date();
      update.resolvedBy = req.user._id;
    }
    const ticket = await SupportTicket.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { $set: update },
      { new: true }
    );
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.assignTicket = async (req, res) => {
  try {
    const { assignedTo } = req.body;
    if (assignedTo) {
      const assignedUser = await User.findOne({ _id: assignedTo, tenantId: req.tenant._id });
      if (!assignedUser) {
        return res.status(400).json({ success: false, message: 'Assigned user not found in this tenant' });
      }
    }
    const ticket = await SupportTicket.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { $set: { assignedTo, status: 'in_progress' } },
      { new: true }
    ).populate('assignedTo', 'name email');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addTicketNote = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Note text is required' });
    }
    const ticket = await SupportTicket.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenant._id },
      { $push: { internalNotes: { text, addedBy: req.user._id, addedByName: req.user.name, addedAt: new Date() } } },
      { new: true }
    );
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAgentPerformance = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };

    if (req.user.role === 'agent') {
      filter.assignedTo = req.user._id;
    }

    const tickets = await SupportTicket.find(filter).lean();
    const agentMap = {};

    for (const t of tickets) {
      const agentId = t.assignedTo?.toString() || 'unassigned';
      if (!agentMap[agentId]) {
        agentMap[agentId] = {
          agentId,
          total: 0, resolved: 0, open: 0,
          avgResolutionTime: 0, totalResolutionTime: 0,
          responseTime: 0, totalResponseTime: 0, responseCount: 0
        };
      }
      agentMap[agentId].total++;
      if (t.status === 'resolved') {
        agentMap[agentId].resolved++;
        if (t.createdAt && t.resolvedAt) {
          agentMap[agentId].totalResolutionTime += new Date(t.resolvedAt) - new Date(t.createdAt);
        }
      } else if (t.status === 'open' || t.status === 'in_progress') {
        agentMap[agentId].open++;
      }
    }

    const agentIds = Object.keys(agentMap).filter(id => id !== 'unassigned');
    const users = await User.find({ _id: { $in: agentIds } }).select('name email').lean();
    const userMap = {};
    for (const u of users) userMap[u._id.toString()] = u;

    for (const [id, data] of Object.entries(agentMap)) {
      if (id !== 'unassigned' && userMap[id]) {
        data.name = userMap[id].name;
        data.email = userMap[id].email;
      } else if (id !== 'unassigned') {
        data.name = 'Unknown Agent';
      }
      if (data.resolved > 0) {
        data.avgResolutionTime = Math.round(data.totalResolutionTime / data.resolved / 60000);
      }
      data.avgResolutionTime = data.avgResolutionTime || 0;
    }

    res.json({ success: true, performance: Object.values(agentMap) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getInboxAnalytics = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant._id };
    const [open, pending, resolved, total, chats] = await Promise.all([
      SupportTicket.countDocuments({ ...filter, status: { $in: ['open', 'in_progress'] } }),
      SupportTicket.countDocuments({ ...filter, status: 'pending' }),
      SupportTicket.countDocuments({ ...filter, status: 'resolved' }),
      SupportTicket.countDocuments(filter),
      Chat.countDocuments({ tenantId: req.tenant._id })
    ]);
    res.json({ success: true, analytics: { open, pending, resolved, total, chats } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
