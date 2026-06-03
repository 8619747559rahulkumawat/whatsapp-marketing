const Contact = require('../models/Contact');
const ContactGroup = require('../models/ContactGroup');
const path = require('path');
const fs = require('fs');

exports.importContacts = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    const groupId = req.body.groupId || null;
    const filePath = req.file.path;

    let contacts = [];

    if (ext === '.csv') {
      const csv = fs.readFileSync(filePath, 'utf8').replace(/\r/g, '');
      const lines = csv.split('\n').filter(Boolean);
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('number') || h === 'no');
      const nameIdx = headers.findIndex(h => h.includes('name'));
      const emailIdx = headers.findIndex(h => h.includes('email'));

      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        if (phoneIdx >= 0 && vals[phoneIdx]) {
          contacts.push({
            phone: vals[phoneIdx].replace(/[^0-9]/g, ''),
            name: nameIdx >= 0 ? vals[nameIdx] : '',
            email: emailIdx >= 0 ? vals[emailIdx] : ''
          });
        }
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const ws = workbook.worksheets[0];
      if (!ws) return res.status(400).json({ success: false, message: 'No worksheet found' });

      const headers = [];
      ws.getRow(1).eachCell(c => headers.push(c.value?.toString().toLowerCase() || ''));
      const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('number') || h === 'no');
      const nameIdx = headers.findIndex(h => h.includes('name'));
      const emailIdx = headers.findIndex(h => h.includes('email'));

      if (phoneIdx < 0) return res.status(400).json({ success: false, message: 'No phone column found' });

      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        const phone = row.getCell(phoneIdx + 1).value?.toString().replace(/[^0-9]/g, '') || '';
        if (phone) {
          contacts.push({
            phone,
            name: nameIdx >= 0 ? (row.getCell(nameIdx + 1).value?.toString() || '') : '',
            email: emailIdx >= 0 ? (row.getCell(emailIdx + 1).value?.toString() || '') : ''
          });
        }
      });
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported format. Use CSV or Excel.' });
    }

    fs.unlink(filePath, () => {});

    let imported = 0, skipped = 0, errors = [];
    for (const c of contacts) {
      try {
        const existing = await Contact.findOne({ phone: c.phone, tenantId: req.tenant._id });
        if (existing) { skipped++; continue; }
        const doc = { ...c, tenantId: req.tenant._id, userId: req.user._id };
        if (groupId) doc.groups = [groupId];
        await Contact.create(doc);
        imported++;
      } catch (err) {
        errors.push(`${c.phone}: ${err.message}`);
      }
    }

    res.json({ success: true, total: contacts.length, imported, skipped, errors: errors.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
