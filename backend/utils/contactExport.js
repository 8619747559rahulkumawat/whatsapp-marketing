const ExcelJS = require('exceljs');

const EXPORT_FORMATS = new Set(['csv', 'xlsx', 'json']);

const normalizeExportFormat = (format) => {
  const normalized = String(format || 'xlsx').trim().toLowerCase();
  return EXPORT_FORMATS.has(normalized) ? normalized : 'xlsx';
};

const getExportContentType = (format) => {
  if (format === 'csv') return 'text/csv; charset=utf-8';
  if (format === 'json') return 'application/json; charset=utf-8';
  return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
};

const escapeCsvValue = (value) => {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const toCsv = (rows) => {
  const headers = ['Name', 'Phone', 'Address', 'Group', 'Admin', 'Session ID', 'Group JID', 'Scraped At'];
  const keys = ['name', 'phone', 'address', 'group', 'admin', 'sessionId', 'groupJid', 'scrapedAt'];
  const lines = [headers.map(escapeCsvValue).join(',')];
  for (const row of rows) {
    lines.push(keys.map((key) => escapeCsvValue(row[key] ?? '')).join(','));
  }
  return lines.join('\n');
};

const buildContactMap = (contacts = []) => {
  const map = new Map();
  for (const contact of contacts) {
    if (!contact?.phone) continue;
    if (!map.has(contact.phone) || contact.name) {
      map.set(contact.phone, contact);
    }
  }
  return map;
};

const buildGroupScrapeRows = (scrapes = [], contacts = []) => {
  const contactMap = buildContactMap(contacts);
  const rowsByPhone = new Map();

  for (const scrape of scrapes) {
    const groupName = scrape.groupName || scrape.groupSubject || '';
    const groupJid = scrape.groupJid || '';
    const scrapedAt = scrape.createdAt ? new Date(scrape.createdAt).toISOString() : '';

    for (const member of scrape.participants || []) {
      const rawPhone = member.phone || (member.jid ? member.jid.split('@')[0] : '');
      const phone = String(rawPhone || '').trim();
      const jid = String(member.jid || '').trim();
      const rowKey = phone || jid;
      if (!rowKey) continue;

      const savedContact = phone ? contactMap.get(phone) : null;
      const existing = rowsByPhone.get(rowKey);
      if (existing) {
        if (groupName && !existing.group.split('; ').includes(groupName)) {
          existing.group = existing.group ? `${existing.group}; ${groupName}` : groupName;
        }
        if (member.isAdmin) existing.admin = 'Yes';
        continue;
      }

      rowsByPhone.set(rowKey, {
        name: (savedContact?.name || member.name || '').trim(),
        phone,
        address: (savedContact?.address || savedContact?.city || '').trim(),
        group: groupName,
        admin: member.isAdmin ? 'Yes' : 'No',
        sessionId: scrape.sessionId || '',
        groupJid,
        scrapedAt
      });
    }
  }

  return Array.from(rowsByPhone.values());
};

const sendContactExport = async (res, rows, { format = 'xlsx', filenameBase = 'contacts' } = {}) => {
  const normalizedFormat = normalizeExportFormat(format);
  const filename = `${filenameBase}.${normalizedFormat}`;

  res.setHeader('Content-Type', getExportContentType(normalizedFormat));
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  try {
    if (normalizedFormat === 'json') {
      return res.send(JSON.stringify({ success: true, count: rows.length, contacts: rows }, null, 2));
    }

    if (normalizedFormat === 'csv') {
      return res.send(toCsv(rows));
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Group Members');
    ws.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Address', key: 'address', width: 35 },
      { header: 'Group', key: 'group', width: 30 },
      { header: 'Admin', key: 'admin', width: 10 },
      { header: 'Session ID', key: 'sessionId', width: 26 },
      { header: 'Group JID', key: 'groupJid', width: 34 },
      { header: 'Scraped At', key: 'scrapedAt', width: 24 }
    ];
    ws.getRow(1).font = { bold: true };
    ws.addRows(rows);
    await wb.xlsx.write(res);
    return res.end();
  } catch (err) {
    console.error('[sendContactExport] Error generating export', {
      format: normalizedFormat,
      rowCount: rows.length,
      error: err.message,
      stack: err.stack
    });
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: `Export generation failed: ${err.message}` });
    }
  }
};

module.exports = {
  buildGroupScrapeRows,
  normalizeExportFormat,
  sendContactExport
};
