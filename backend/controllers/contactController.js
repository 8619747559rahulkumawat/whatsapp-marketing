const Contact = require('../models/Contact');
const ContactGroup = require('../models/ContactGroup');
const GroupScrape = require('../models/GroupScrape');
const whatsappService = require('../services/whatsappService');
const { formatPhoneNumber, calculatePagination } = require('../utils/helpers');
const csv = require('csv-parser');
const { Readable } = require('stream');

exports.getContacts = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    if (req.query.groupId) {
      filter.groups = req.query.groupId;
    }
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { phone: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    const { skip, limit, page } = calculatePagination(req.query.page, req.query.limit);
    const contacts = await Contact.find(filter)
      .populate('groups', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // If user is admin, hide sensitive contact data for other users' contacts
    if (req.user.role === 'admin') {
      const sanitizedContacts = contacts.map(contact => {
        // Convert to plain object to avoid modifying original Mongoose document
        const contactObj = contact.toObject ? contact.toObject() : { ...contact };
        
        // If contact belongs to another user, hide sensitive fields
        if (contactObj.userId && contactObj.userId.toString() !== req.user._id.toString()) {
          // Hide potentially sensitive data, keeping only essential system-level info
          contactObj.name = '[Private Contact]';
          contactObj.phone = '[Private]';
          contactObj.email = '[Private]';
          contactObj.tags = [];
          contactObj.customFields = {};
          // Keep groups for system monitoring
          // Keep timestamps for system monitoring
        }
        
        return contactObj;
      });
      
      const total = await Contact.countDocuments(filter);
      res.json({
        success: true,
        contacts: sanitizedContacts,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      });
    } else {
      const total = await Contact.countDocuments(filter);
      res.json({
        success: true,
        contacts,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id).populate('groups', 'name');
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    res.json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createContact = async (req, res) => {
  try {
    const { name, phone, countryCode, email, tags, groups, customFields } = req.body;
    const formattedPhone = formatPhoneNumber(phone, countryCode || process.env.DEFAULT_COUNTRY_CODE || '91');
    const exists = await Contact.findOne({ userId: req.user._id, phone: formattedPhone });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Contact with this phone already exists' });
    }
    const contact = await Contact.create({
      userId: req.user._id,
      tenantId: req.tenant?._id || req.user.tenantId,
      name,
      phone: formattedPhone,
      countryCode: countryCode || process.env.DEFAULT_COUNTRY_CODE || '91',
      email,
      tags: tags || [],
      groups: groups || [],
      customFields: customFields || {}
    });
    if (groups && groups.length > 0) {
      for (const gId of groups) {
        await ContactGroup.findByIdAndUpdate(gId, { $inc: { contactCount: 1 } });
      }
    }
    res.status(201).json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateContact = async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'email', 'countryCode', 'tags', 'groups', 'customFields', 'notes', 'isBlacklisted'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const contact = await Contact.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    res.json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (contact && contact.groups.length > 0) {
      for (const gId of contact.groups) {
        await ContactGroup.findByIdAndUpdate(gId, { $inc: { contactCount: -1 } });
      }
    }
    res.json({ success: true, message: 'Contact deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.importContacts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'CSV file required' });
    }
    const results = [];
    const stream = Readable.from(req.file.buffer.toString());
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });
    let imported = 0;
    let skipped = 0;
    for (const row of results) {
      try {
        const phone = formatPhoneNumber(row.phone || row.Phone || row.mobile || row.mobile_number);
        const exists = await Contact.findOne({ userId: req.user._id, phone });
        if (!exists) {
          await Contact.create({
            userId: req.user._id,
            tenantId: req.tenant?._id || req.user.tenantId,
            name: row.name || row.Name || row.full_name || '',
            phone,
            email: row.email || row.Email || '',
            source: 'import'
          });
          imported++;
        } else {
          skipped++;
        }
      } catch { skipped++; }
    }
    res.json({ success: true, imported, skipped, total: results.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.exportContacts = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    const contacts = await Contact.find(filter).lean();
    let csv = 'Name,Phone,Email,Tags\n';
    for (const c of contacts) {
      csv += `"${c.name || ''}","${c.phone}","${c.email || ''}","${(c.tags || []).join(';')}"\n`;
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.bulkDelete = async (req, res) => {
  try {
    const { ids } = req.body;
    await Contact.deleteMany({ _id: { $in: ids }, userId: req.user._id });
    res.json({ success: true, message: `${ids.length} contacts deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getGroups = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    const groups = await ContactGroup.find(filter).sort({ name: 1 });
    res.json({ success: true, groups });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createGroup = async (req, res) => {
  try {
    const { name, description } = req.body;
    const group = await ContactGroup.create({
      userId: req.user._id,
      tenantId: req.tenant?._id || req.user.tenantId,
      name,
      description
    });
    res.status(201).json({ success: true, group });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const group = await ContactGroup.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    res.json({ success: true, group });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const group = await ContactGroup.findByIdAndDelete(req.params.id);
    if (group) {
      await Contact.updateMany({ groups: group._id }, { $pull: { groups: group._id } });
    }
    res.json({ success: true, message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTagStats = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    const contacts = await Contact.find(filter).lean();
    const tagMap = {};
    for (const c of contacts) {
      if (c.tags && Array.isArray(c.tags)) {
        for (const tag of c.tags) {
          tagMap[tag] = (tagMap[tag] || 0) + 1;
        }
      }
    }
    const stats = Object.entries(tagMap).map(([tag, count]) => ({ tag, count }));
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getContactVariables = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    const contacts = await Contact.find(filter).lean().limit(100);
    const variables = new Set();
    for (const c of contacts) {
      if (c.customFields && typeof c.customFields === 'object') {
        Object.keys(c.customFields).forEach(k => variables.add(k));
      }
    }
    res.json({ success: true, variables: Array.from(variables) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addContactsToGroup = async (req, res) => {
  try {
    const { contactIds } = req.body;
    await Contact.updateMany(
      { _id: { $in: contactIds }, userId: req.user._id },
      { $addToSet: { groups: req.params.id } }
    );
    const group = await ContactGroup.findByIdAndUpdate(req.params.id, {
      $inc: { contactCount: contactIds.length }
    });
    res.json({ success: true, message: `${contactIds.length} contacts added` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getGroupScrapes = async (req, res) => {
  try {
    const filter = { tenantId: req.tenant?._id || req.user?.tenantId, userId: req.user._id };
    const scrapes = await GroupScrape.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, scrapes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.startGroupScrape = async (req, res) => {
  try {
    const { groupJid, groupName, sessionId } = req.body;
    if (!groupJid || !sessionId) {
      return res.status(400).json({ success: false, message: 'Group JID and session ID required' });
    }

    const sock = await whatsappService.getReadySocket(sessionId);
    if (!sock || !sock.user) {
      return res.status(400).json({ success: false, message: 'WhatsApp session not connected. Please scan QR code first.' });
    }

    let participants = [];
    let groupSubject = groupName || groupJid;
    try {
      const metadata = await sock.groupMetadata(groupJid);
      groupSubject = metadata.subject || groupSubject;
      participants = (metadata.participants || []).map(p => ({
        jid: p.id,
        name: '',
        phone: (p.id.split('@')[0]).slice(-10),
        isAdmin: ['admin', 'superadmin'].includes(p.admin || '')
      }));
    } catch (err) {
      console.log(`[GroupScrape] Could not fetch metadata for ${groupJid}, saving without participants:`, err.message);
    }

    const scrape = await GroupScrape.create({
      tenantId: req.tenant?._id || req.user?.tenantId,
      userId: req.user._id,
      sessionId,
      groupJid,
      groupName: groupSubject,
      groupSubject,
      participants,
      totalMembers: participants.length,
      status: 'completed'
    });
    res.status(201).json({ success: true, scrape, message: `Group scraped successfully with ${participants.length} members.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.scrapeAllGroups = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID required' });
    }

    const sock = await whatsappService.getReadySocket(sessionId);
    if (!sock || !sock.user) {
      return res.status(400).json({ success: false, message: 'WhatsApp session not connected. Please scan QR code first.' });
    }

    const allGroups = await sock.groupFetchAllParticipating();
    const groupEntries = Object.entries(allGroups);
    if (!groupEntries.length) {
      return res.status(400).json({ success: false, message: 'No WhatsApp groups found on this account.' });
    }

    const seen = new Map();
    let totalScraped = 0;
    const errors = [];

    for (const [jid, g] of groupEntries) {
      try {
        const metadata = await sock.groupMetadata(jid);
        for (const p of (metadata.participants || [])) {
          if (!seen.has(p.id)) {
            seen.set(p.id, {
              jid: p.id,
              name: '',
              phone: (p.id.split('@')[0]).slice(-10),
              isAdmin: ['admin', 'superadmin'].includes(p.admin || '')
            });
          }
        }
        totalScraped += metadata.participants?.length || 0;
      } catch (err) {
        errors.push(g.subject || jid);
      }
    }

    const participants = Array.from(seen.values());

    const scrape = await GroupScrape.create({
      tenantId: req.tenant?._id || req.user?.tenantId,
      userId: req.user._id,
      sessionId,
      groupJid: groupEntries.map(([jid]) => jid).join(','),
      groupName: `All Groups (${groupEntries.length} groups, ${participants.length} unique members)`,
      groupSubject: `Bulk scrape from ${groupEntries.length} groups`,
      participants,
      totalMembers: participants.length,
      status: 'completed'
    });

    res.status(201).json({
      success: true,
      scrape,
      message: `Scraped ${participants.length} unique members from ${groupEntries.length} groups.${errors.length ? ` Failed for: ${errors.join(', ')}` : ''}`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getGroupScrapeMembers = async (req, res) => {
  try {
    const scrape = await GroupScrape.findOne({ _id: req.params.id, tenantId: req.tenant?._id || req.user?.tenantId });
    if (!scrape) return res.status(404).json({ success: false, message: 'Scrape not found' });
    res.json({ success: true, members: scrape.participants || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.exportGroupScrape = async (req, res) => {
  try {
    const scrape = await GroupScrape.findOne({ _id: req.params.id, tenantId: req.tenant?._id || req.user?.tenantId });
    if (!scrape) return res.status(404).json({ success: false, message: 'Scrape not found' });

    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Group Members');

    ws.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Address', key: 'address', width: 35 },
      { header: 'Group', key: 'group', width: 30 },
      { header: 'Admin', key: 'admin', width: 10 }
    ];
    ws.getRow(1).font = { bold: true };

    const participants = scrape.participants || [];
    const phones = participants.map(m => m.phone || m.jid?.split('@')[0]).filter(Boolean);
    const existingContacts = await Contact.find({ userId: req.user._id, phone: { $in: phones } }).lean();
    const contactMap = {};
    for (const c of existingContacts) {
      if (!contactMap[c.phone] || c.name) contactMap[c.phone] = c;
    }

    for (const m of participants) {
      const phone = m.phone || m.jid?.split('@')[0] || '';
      const contact = contactMap[phone];
      ws.addRow({
        name: (contact?.name || m.name || '').trim(),
        phone,
        address: (contact?.address || contact?.city || '').trim(),
        group: scrape.groupName || scrape.groupSubject || '',
        admin: m.isAdmin ? 'Yes' : 'No'
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=group-${scrape._id}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.importGroupScrape = async (req, res) => {
  try {
    const scrape = await GroupScrape.findOne({ _id: req.params.id, tenantId: req.tenant?._id || req.user?.tenantId });
    if (!scrape) return res.status(404).json({ success: false, message: 'Scrape not found' });
    let imported = 0;
    for (const m of (scrape.participants || [])) {
      const phone = m.phone || m.jid?.split('@')[0];
      if (!phone) continue;
      const exists = await Contact.findOne({ userId: req.user._id, phone });
      if (!exists) {
        await Contact.create({
          userId: req.user._id,
          tenantId: req.tenant?._id || req.user?.tenantId,
          name: m.name || '',
          phone,
          source: 'group_scrape',
          tags: scrape.groupName ? [scrape.groupName] : []
        });
        imported++;
      }
    }
    await GroupScrape.findByIdAndUpdate(scrape._id, { $set: { imported: true, importedCount: imported } });
    res.json({ success: true, imported, total: scrape.participants?.length || 0 });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteGroupScrape = async (req, res) => {
  try {
    await GroupScrape.findOneAndDelete({ _id: req.params.id, tenantId: req.tenant?._id || req.user?.tenantId });
    res.json({ success: true, message: 'Scrape deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.scrapeGroupMessages = async (req, res) => {
  try {
    const { groupJid, sessionId, limit: msgLimit = 50 } = req.body;
    if (!groupJid || !sessionId) {
      return res.status(400).json({ success: false, message: 'Group JID and session ID required' });
    }
    const sock = await whatsappService.getReadySocket(sessionId);
    if (!sock || !sock.user) {
      return res.status(400).json({ success: false, message: 'WhatsApp session not connected' });
    }
    const messages = await sock.loadMessages(groupJid, Math.min(msgLimit, 200));
    const parsed = (messages || []).map(m => {
      const key = m.key;
      const msg = m.message;
      let content = '';
      let type = 'text';
      if (msg) {
        if (msg.conversation) { content = msg.conversation; }
        else if (msg.extendedTextMessage?.text) { content = msg.extendedTextMessage.text; }
        else if (msg.imageMessage) { content = '[Image]'; type = 'image'; }
        else if (msg.videoMessage) { content = '[Video]'; type = 'video'; }
        else if (msg.audioMessage) { content = '[Audio]'; type = 'audio'; }
        else if (msg.documentMessage) { content = `[Document: ${msg.documentMessage.fileName || ''}]`; type = 'document'; }
        else if (msg.stickerMessage) { content = '[Sticker]'; type = 'sticker'; }
        else { content = '[Message]'; type = 'other'; }
      }
      const sender = key.participant || key.remoteJid || '';
      const senderPhone = sender.split('@')[0] || '';
      return {
        msgId: key.id || '',
        sender,
        senderJid: sender,
        senderName: '',
        senderPhone: senderPhone,
        content,
        type,
        timestamp: new Date((m.messageTimestamp || 0) * 1000),
        quotedMsg: ''
      };
    });
    parsed.sort((a, b) => a.timestamp - b.timestamp);
    const filter = { groupJid, sessionId, tenantId: req.tenant?._id || req.user?.tenantId };
    const existing = await GroupScrape.findOne(filter);
    if (existing) {
      existing.messages = parsed;
      existing.totalMessages = parsed.length;
      await existing.save();
    }
    res.json({ success: true, messages: parsed, total: parsed.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getScrapedMessages = async (req, res) => {
  try {
    const scrape = await GroupScrape.findOne({ _id: req.params.id, tenantId: req.tenant?._id || req.user?.tenantId });
    if (!scrape) return res.status(404).json({ success: false, message: 'Scrape not found' });
    res.json({ success: true, messages: scrape.messages || [], total: scrape.totalMessages || 0 });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.exportGroupMessages = async (req, res) => {
  try {
    const scrape = await GroupScrape.findOne({ _id: req.params.id, tenantId: req.tenant?._id || req.user?.tenantId });
    if (!scrape) return res.status(404).json({ success: false, message: 'Scrape not found' });
    const msgs = scrape.messages || [];
    if (!msgs.length) return res.status(400).json({ success: false, message: 'No messages to export' });
    const XLSX = require('xlsx');
    const data = msgs.map(m => ({
      'Sender Number': m.senderPhone || '',
      'Sender JID': m.senderJid || m.sender || '',
      'Content': m.content || '',
      'Type': m.type || 'text',
      'Timestamp': m.timestamp ? new Date(m.timestamp).toISOString() : '',
      'Message ID': m.msgId || ''
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Messages');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=group-messages-${scrape._id}.xlsx`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
