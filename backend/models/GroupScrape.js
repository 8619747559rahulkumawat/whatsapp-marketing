const mongoose = require('mongoose');

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

module.exports = mongoose.model('GroupScrape', groupScrapeSchema);
