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
  if (digits.length < 10) return '';
  const phone = digits.slice(-10);
  if (phone.startsWith('0') || phone.length !== 10) return '';
  return phone;
};

const cleanContactName = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const isLikelyInvalidPhone = (phone) => {
  if (!phone || phone.length !== 10) return true;
  if (/^0{10}$/.test(phone)) return true;
  if (/^(\d)\1{9}$/.test(phone)) return true;
  return false;
};

const isUsableContactName = (value) => {
  const name = cleanContactName(value);
  if (!name) return false;
  const digits = name.replace(/[^0-9]/g, '');
  return !(digits.length >= 10 && digits === name.replace(/[^0-9]/g, ''));
};

const normalizeContactExportRows = (rows = [], { requireName = false } = {}) => {
  const byPhone = new Map();
  let invalidPhones = 0;
  let duplicatePhones = 0;
  let skippedNames = 0;

  for (const row of rows) {
    const phone = normalizePhone10(row.phone || row.Phone || row.jid);
    if (!phone) { invalidPhones++; continue; }
    if (isLikelyInvalidPhone(phone)) { invalidPhones++; continue; }

    const name = cleanContactName(row.name || row.Name);
    if (requireName && !isUsableContactName(name)) { skippedNames++; continue; }

    const finalName = name || 'Unknown';

    const normalized = {
      ...row,
      name: finalName,
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

    duplicatePhones++;
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

  const exportRows = Array.from(byPhone.values());
  return {
    rows: exportRows,
    stats: {
      totalInput: rows.length,
      totalExported: exportRows.length,
      duplicatesRemoved: duplicatePhones,
      invalidPhones,
      skippedNames
    }
  };
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
  const { rows: exportRows, stats } = normalizeContactExportRows(rows, { requireName });

  console.log('[ExportStats]', JSON.stringify({ filenameBase, format: normalizedFormat, ...stats }));

  res.setHeader('Content-Type', getExportContentType(normalizedFormat));
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  try {
    if (normalizedFormat === 'json') {
      return res.send(JSON.stringify({ success: true, ...stats, contacts: exportRows }, null, 2));
    }

    if (normalizedFormat === 'csv') {
      return res.send(toCsv(exportRows));
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(requireName ? 'Phone Contacts' : 'Group Members');

    const summarySheet = wb.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.addRow({ metric: 'Total Contacts Found', value: stats.totalInput });
    summarySheet.addRow({ metric: 'Total Exported', value: stats.totalExported });
    summarySheet.addRow({ metric: 'Duplicates Removed', value: stats.duplicatesRemoved });
    summarySheet.addRow({ metric: 'Invalid Numbers Removed', value: stats.invalidPhones });
    summarySheet.addRow({ metric: 'Contacts Without Name', value: stats.totalExported });
    summarySheet.addRow({ metric: 'Generated At', value: new Date().toISOString() });

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
