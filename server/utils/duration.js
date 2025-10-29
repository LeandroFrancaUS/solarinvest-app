const UNIT_SECONDS = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
  w: 7 * 24 * 60 * 60,
};

export function parseDuration(value, defaultSeconds) {
  if (value == null || value === '') {
    return defaultSeconds;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value !== 'string') {
    return defaultSeconds;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return defaultSeconds;
  }
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.floor(numeric));
  }
  const match = /^([0-9]+(?:\.[0-9]+)?)\s*([smhdw])$/i.exec(trimmed);
  if (!match) {
    return defaultSeconds;
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || !(unit in UNIT_SECONDS)) {
    return defaultSeconds;
  }
  return Math.max(0, Math.round(amount * UNIT_SECONDS[unit]));
}

export function secondsFromNow(seconds) {
  const now = Date.now();
  return new Date(now + seconds * 1000).toISOString();
}

export function hasExpired(isoDate) {
  if (!isoDate) return false;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= Date.now();
}
