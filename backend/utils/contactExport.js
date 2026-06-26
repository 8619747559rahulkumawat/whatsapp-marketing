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

const normalizePhone = (value) => {
  const raw = String(value || '').split('@')[0].replace(/[^0-9]/g, '');
  if (raw.length < 10) return '';
  return raw.slice(-10);
};

const isLikelyInvalidPhone = (phone) => {
  if (!phone || phone.length !== 10) return true;
  if (/^0{10}$/.test(phone)) return true;
  if (/^(\d)\1{9}$/.test(phone)) return true;
  return false;
};

const cleanContactName = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const isUsableContactName = (value) => {
  const name = cleanContactName(value);
  if (!name) return false;
  const digits = name.replace(/[^0-9]/g, '');
  return !(digits.length >= 10 && digits === name);
};

const normalizeContactExportRows = (rows = [], { requireName = false } = {}) => {
  const byPhone = new Map();
  let invalidPhones = 0;
  let duplicatePhones = 0;
  let skippedNames = 0;
  let loggedSamples = 0;

  for (const row of rows) {
    const phone = normalizePhone(row.phone || row.Phone || row.jid);
    if (!phone) {
      invalidPhones++;
      if (loggedSamples < 3) {
        console.log('[ExportNormalize][InvalidPhone]', {
          inputPhone: row.phone || row.Phone || row.jid,
          reason: 'empty_after_normalize'
        });
        loggedSamples++;
      }
      continue;
    }
    if (isLikelyInvalidPhone(phone)) {
      invalidPhones++;
      if (loggedSamples < 3) {
        console.log('[ExportNormalize][InvalidPhone]', {
          inputPhone: row.phone || row.Phone || row.jid,
          normalizedPhone: phone,
          reason: 'isLikelyInvalidPhone'
        });
        loggedSamples++;
      }
      continue;
    }

    const name = cleanContactName(row.name || row.Name);
    if (requireName && !isUsableContactName(name)) { skippedNames++; continue; }

    const finalName = name || 'Unknown';

    if (loggedSamples < 5) {
      console.log('[ExportNormalize][Sample]', {
        inputPhone: row.phone || row.Phone || row.jid,
        normalizedPhone: phone,
        inputName: row.name || row.Name,
        normalizedName: finalName,
        source: row.group || ''
      });
      loggedSamples++;
    }

    const existing = byPhone.get(phone);
    if (existing) {
      duplicatePhones++;
      if (finalName !== 'Unknown' && (existing.name === 'Unknown' || !existing.name)) existing.name = finalName;
      if (row.group && !String(existing.group || '').split('; ').includes(row.group)) {
        existing.group = existing.group ? `${existing.group}; ${row.group}` : row.group;
      }
      continue;
    }

    byPhone.set(phone, {
      name: finalName,
      phone,
      group: cleanContactName(row.group || row.Group) || 'WhatsApp Contacts'
    });
  }

  const exportRows = Array.from(byPhone.values());
  const withNames = exportRows.filter(r => r.name && r.name !== 'Unknown').length;
  const withoutNames = exportRows.length - withNames;
  return {
    rows: exportRows,
    stats: {
      totalInput: rows.length,
      totalExported: exportRows.length,
      totalValid: exportRows.length,
      totalInvalid: invalidPhones,
      duplicatesRemoved: duplicatePhones,
      skippedNames,
      withNames,
      withoutNames
    }
  };
};

const toCsv = (rows) => {
  const headers = ['Name', 'Phone Number'];
  const keys = ['name', 'phone'];
  const lines = [headers.map(escapeCsvValue).join(',')];
  for (const row of rows) {
    lines.push(keys.map((key) => escapeCsvValue(row[key] ?? '')).join(','));
  }
  return '\uFEFF' + lines.join('\n');
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

    for (const member of scrape.participants || []) {
      const rawPhone = member.phone || (member.jid ? member.jid.split('@')[0] : '');
      const phone = normalizePhone(rawPhone);
      const jid = String(member.jid || '').trim();
      const rowKey = phone || jid;
      if (!rowKey) continue;

      const savedContact = phone ? contactMap.get(phone) : null;
      const existing = rowsByPhone.get(rowKey);
      if (existing) {
        if (groupName && !existing.group.split('; ').includes(groupName)) {
          existing.group = existing.group ? `${existing.group}; ${groupName}` : groupName;
        }
        continue;
      }

      rowsByPhone.set(rowKey, {
        name: (savedContact?.name || member.name || '').trim(),
        phone,
        group: groupName,
      });
    }
  }

  return Array.from(rowsByPhone.values());
};

const sendContactExport = async (res, rows, { format = 'xlsx', filenameBase = 'contacts', requireName = false } = {}) => {
  const normalizedFormat = normalizeExportFormat(format);
  const filename = `${filenameBase}.${normalizedFormat}`;
  const { rows: exportRows, stats } = normalizeContactExportRows(rows, { requireName });

  console.log('[ExportStats]', JSON.stringify({
    filenameBase,
    format: normalizedFormat,
    totalInput: stats.totalInput,
    totalExported: stats.totalExported,
    totalValid: stats.totalValid,
    totalInvalid: stats.totalInvalid,
    duplicatesRemoved: stats.duplicatesRemoved,
    withNames: stats.withNames,
    withoutNames: stats.withoutNames
  }, null, 2));

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
    const ws = wb.addWorksheet('Contacts');

    const summarySheet = wb.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.addRow({ metric: 'Total Contacts Found', value: stats.totalInput });
    summarySheet.addRow({ metric: 'Total Valid Contacts', value: stats.totalValid });
    summarySheet.addRow({ metric: 'Total Invalid Contacts', value: stats.totalInvalid });
    summarySheet.addRow({ metric: 'Total Duplicates Removed', value: stats.duplicatesRemoved });
    summarySheet.addRow({ metric: 'Contacts With Names', value: stats.withNames || 0 });
    summarySheet.addRow({ metric: 'Contacts Without Names', value: stats.withoutNames || 0 });
    summarySheet.addRow({ metric: 'Generated At', value: new Date().toISOString() });

    ws.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Phone Number', key: 'phone', width: 20 }
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
  normalizePhone,
  normalizeExportFormat,
  sendContactExport
};
