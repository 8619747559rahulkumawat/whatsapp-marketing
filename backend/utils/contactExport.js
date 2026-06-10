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

const normalizePhone10 = (value) => {
  const digits = String(value || '').split('@')[0].replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
};

const cleanContactName = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const isUsableContactName = (value) => {
  const name = cleanContactName(value);
  if (!name) return false;
  const digits = name.replace(/[^0-9]/g, '');
  return !(digits.length >= 10 && digits === name.replace(/[^0-9]/g, ''));
};

const normalizeContactExportRows = (rows = [], { requireName = false } = {}) => {
  const byPhone = new Map();

  for (const row of rows) {
    const phone = normalizePhone10(row.phone || row.Phone || row.jid);
    if (!phone) continue;

    const name = cleanContactName(row.name || row.Name);
    if (requireName && !isUsableContactName(name)) continue;

    const normalized = {
      ...row,
      name,
      phone,
      address: cleanContactName(row.address || row.Address || row.city),
      group: cleanContactName(row.group || row.Group),
      admin: row.admin || row.Admin || '',
      sessionId: row.sessionId || row['Session ID'] || '',
      groupJid: row.groupJid || row['Group JID'] || '',
      scrapedAt: row.scrapedAt || row['Scraped At'] || ''
    };

    const existing = byPhone.get(phone);
    if (!existing) {
      byPhone.set(phone, normalized);
      continue;
    }

    if (!existing.name && normalized.name) existing.name = normalized.name;
    if (!existing.address && normalized.address) existing.address = normalized.address;
    if (normalized.group && !String(existing.group || '').split('; ').includes(normalized.group)) {
      existing.group = existing.group ? `${existing.group}; ${normalized.group}` : normalized.group;
    }
    if (normalized.admin === 'Yes') existing.admin = 'Yes';
    if (!existing.sessionId && normalized.sessionId) existing.sessionId = normalized.sessionId;
    if (!existing.groupJid && normalized.groupJid) existing.groupJid = normalized.groupJid;
    if (!existing.scrapedAt && normalized.scrapedAt) existing.scrapedAt = normalized.scrapedAt;
  }

  return Array.from(byPhone.values());
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

const sendContactExport = async (res, rows, { format = 'xlsx', filenameBase = 'contacts', requireName = false } = {}) => {
  const normalizedFormat = normalizeExportFormat(format);
  const filename = `${filenameBase}.${normalizedFormat}`;
  const exportRows = normalizeContactExportRows(rows, { requireName });

  res.setHeader('Content-Type', getExportContentType(normalizedFormat));
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  try {
    if (normalizedFormat === 'json') {
      return res.send(JSON.stringify({ success: true, count: exportRows.length, contacts: exportRows }, null, 2));
    }

    if (normalizedFormat === 'csv') {
      return res.send(toCsv(exportRows));
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(requireName ? 'Phone Contacts' : 'Group Members');
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
    ws.addRows(exportRows);
    await wb.xlsx.write(res);
    return res.end();
  } catch (err) {
    console.error('[sendContactExport] Error generating export', {
      format: normalizedFormat,
      rowCount: exportRows.length,
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
  cleanContactName,
  isUsableContactName,
  normalizeContactExportRows,
  normalizePhone10,
  normalizeExportFormat,
  sendContactExport
};
