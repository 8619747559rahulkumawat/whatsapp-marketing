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
    // Already has + prefix — check if it already has country code
    const withoutPlus = cleaned.substring(1);
    if (withoutPlus.startsWith(countryCode)) {
      return cleaned; // Already correctly formatted: +91XXXXXXXXXX
    }
    // Has + but different country code, replace
    cleaned = withoutPlus;
  }
  // Strip leading 0 (local format: 0XXXXXXXXXX)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  // Already has country code as prefix
  if (cleaned.startsWith(countryCode) && cleaned.length > countryCode.length) {
    return `+${cleaned}`;
  }
  // Missing country code — prepend it
  return `+${countryCode}${cleaned}`;
};

// Strip everything except digits — used for JID construction
const stripToDigits = (phone) => {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '');
};

const calculatePagination = (page = 1, limit = 20) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit) || 20));
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
  const count = Math.max(0, parseInt(contactsCount) || 0);
  const creditsPerMessage = messageType === 'text' ? 1 : 2;
  return count * creditsPerMessage;
};

module.exports = {
  generateApiKey,
  generateSessionId,
  formatPhoneNumber,
  stripToDigits,
  calculatePagination,
  buildFilterFromQuery,
  calculateCreditsNeeded
};
