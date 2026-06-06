const mongoose = require('mongoose');
const { addRetentionIndex, parsePositiveInt, truncateText } = require('../utils/dataRetention');

const groupScrapeSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String, default: '' },
  groupJid: { type: String, required: true },
  groupName: { type: String, default: '' },
  groupSubject: { type: String, default: '' },
  participants: [{
    jid: String,
    name: String,
    phone: String,
    isAdmin: { type: Boolean, default: false }
  }],
  totalMembers: { type: Number, default: 0 },
  imported: { type: Boolean, default: false },
  importedCount: { type: Number, default: 0 },
  duplicateCount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'scraping', 'completed', 'failed'], default: 'pending' },
  tags: [{ type: String }],
  messages: [{
    msgId: String,
    sender: String,
    senderName: String,
    senderPhone: String,
    senderJid: String,
    content: String,
    type: { type: String, default: 'text' },
    timestamp: { type: Date },
    quotedMsg: String
  }],
  totalMessages: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

groupScrapeSchema.index({ tenantId: 1, userId: 1 });
groupScrapeSchema.index({ groupJid: 1 });
addRetentionIndex(groupScrapeSchema, 'updatedAt', 'GROUP_SCRAPE', 30);

groupScrapeSchema.pre('validate', function trimGroupScrapePayload(next) {
  const maxParticipants = parsePositiveInt(process.env.GROUP_SCRAPE_MAX_PARTICIPANTS, 5000);
  const maxMessages = parsePositiveInt(process.env.GROUP_SCRAPE_MAX_MESSAGES, 100);
  this.updatedAt = new Date();

  if (Array.isArray(this.participants) && this.participants.length > maxParticipants) {
    this.participants = this.participants.slice(0, maxParticipants);
    this.totalMembers = maxParticipants;
  }

  if (Array.isArray(this.messages)) {
    const limitedMessages = maxMessages > 0 ? this.messages.slice(-maxMessages) : [];
    this.messages = limitedMessages.map((message) => ({
      msgId: message.msgId || '',
      sender: message.sender || '',
      senderName: truncateText(message.senderName || '', 100),
      senderPhone: message.senderPhone || '',
      senderJid: message.senderJid || '',
      content: truncateText(message.content, 500),
      type: message.type || 'text',
      timestamp: message.timestamp,
      quotedMsg: truncateText(message.quotedMsg || '', 300)
    }));
    this.totalMessages = this.messages.length;
  }

  next();
});

module.exports = mongoose.model('GroupScrape', groupScrapeSchema);
