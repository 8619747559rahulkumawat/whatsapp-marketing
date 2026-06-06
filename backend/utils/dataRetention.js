const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const retentionDays = (envName, fallbackDays) => {
  if (process.env.DATA_RETENTION_ENABLED === 'false') return 0;
  return parsePositiveInt(process.env[`${envName}_RETENTION_DAYS`], fallbackDays);
};

const retentionSeconds = (envName, fallbackDays) => {
  const days = retentionDays(envName, fallbackDays);
  return days > 0 ? days * 24 * 60 * 60 : 0;
};

const addRetentionIndex = (schema, field, envName, fallbackDays, options = {}) => {
  const seconds = retentionSeconds(envName, fallbackDays);
  if (!seconds) return;

  schema.index(
    { [field]: 1 },
    {
      expireAfterSeconds: seconds,
      name: `ttl_${envName.toLowerCase()}_${field}`,
      ...options
    }
  );
};

const truncateText = (value, maxChars = 2000) => {
  if (value === undefined || value === null) return value;
  const text = String(value);
  return text.length > maxChars ? text.slice(0, maxChars) : text;
};

const compactObject = (value, maxChars = 4000) => {
  if (!value || typeof value !== 'object') return value;

  try {
    const encoded = JSON.stringify(value);
    if (!encoded || encoded.length <= maxChars) return value;
    return {
      truncated: true,
      preview: encoded.slice(0, maxChars)
    };
  } catch {
    return { truncated: true, preview: '[unserializable metadata]' };
  }
};

module.exports = {
  addRetentionIndex,
  compactObject,
  parsePositiveInt,
  retentionDays,
  truncateText
};
