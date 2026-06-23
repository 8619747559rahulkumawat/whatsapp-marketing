const crypto = require('crypto');

const generateApiKey = () => {
  return `wam_${crypto.randomBytes(32).toString('hex')}`;
};

const generateSessionId = () => {
  return `session_${crypto.randomBytes(16).toString('hex')}`;
};

const formatPhoneNumber = (phone, countryCode = process.env.DEFAULT_COUNTRY_CODE || '91') => {
  if (!phone) return '';
  let cleaned = phone.replace(/[^+\d]/g, '');
  if (cleaned.startsWith('+')) {
    if (cleaned.startsWith(`+${countryCode}`)) {
      return cleaned;
    }
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith(countryCode) && cleaned.length > countryCode.length) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  return `+${countryCode}${cleaned}`;
};

const calculatePagination = (page = 1, limit = 20) => {
  const p = Math.max(1, parseInt(page));
  const l = Math.min(100, Math.max(1, parseInt(limit)));
  return { skip: (p - 1) * l, limit: l, page: p };
};

const buildFilterFromQuery = (query, allowedFields = []) => {
  const filter = {};
  for (const [key, value] of Object.entries(query)) {
    if (allowedFields.includes(key) && value) {
      if (typeof value === 'string' && value.includes(',')) {
        filter[key] = { $in: value.split(',') };
      } else if (key === 'search') {
        filter.$or = allowedFields.filter(f => f !== 'search').map(f => ({
          [f]: { $regex: value, $options: 'i' }
        }));
      } else {
        filter[key] = value;
      }
    }
  }
  return filter;
};

const calculateCreditsNeeded = (contactsCount, messageType = 'text') => {
  const creditsPerMessage = messageType === 'text' ? 1 : 2;
  return contactsCount * creditsPerMessage;
};

module.exports = {
  generateApiKey,
  generateSessionId,
  formatPhoneNumber,
  calculatePagination,
  buildFilterFromQuery,
  calculateCreditsNeeded
};
