function normalizeYear(value) {
  const year = Number(value);
  if (!Number.isInteger(year)) return null;
  return String(value).length === 2 ? 2000 + year : year;
}

function isValidDate(year, month, day) {
  if (!Number.isInteger(year) || year < 2000 || year > 2099) return false;
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day;
}

function formatDate(year, month, day) {
  return [year, month, day].map((value, index) => String(value).padStart(index ? 2 : 4, '0')).join('-');
}

function buildCandidate(year, month, day, dateOrder) {
  return isValidDate(year, month, day) ? { catchDate: formatDate(year, month, day), dateOrder } : null;
}

function getNumericDateParts(value) {
  const text = String(value || '').trim();
  const separated = text.match(/^(\d{1,4})[\/.,-](\d{1,2})[\/.,-](\d{1,4})$/);
  if (separated) return separated.slice(1);

  if (!/^\d{6}$|^\d{8}$/.test(text)) return null;
  if (text.length === 8 && text.startsWith('20')) {
    return [text.slice(0, 4), text.slice(4, 6), text.slice(6, 8)];
  }
  return text.length === 8
    ? [text.slice(0, 2), text.slice(2, 4), text.slice(4, 8)]
    : [text.slice(0, 2), text.slice(2, 4), text.slice(4, 6)];
}

function emptyResult(dateAmbiguous = false) {
  return { catchDate: null, dateAmbiguous, dateOrder: null, usedPreferredOrder: false };
}

function parseShinyOcrDate(value, preferredDateOrder = null) {
  const parts = getNumericDateParts(value);
  if (!parts) return emptyResult();

  const [rawFirst, rawSecond, rawThird] = parts;
  const first = Number(rawFirst);
  const second = Number(rawSecond);
  const third = Number(rawThird);
  if ([first, second, third].some((part) => !Number.isInteger(part))) {
    return emptyResult();
  }

  if (rawFirst.length === 4) {
    const candidate = buildCandidate(first, second, third, 'ymd');
    return candidate
      ? { ...candidate, dateAmbiguous: false, usedPreferredOrder: false }
      : emptyResult();
  }

  const trailingYear = normalizeYear(rawThird);
  const candidates = [
    buildCandidate(trailingYear, first, second, 'mdy'),
    buildCandidate(trailingYear, second, first, 'dmy'),
    preferredDateOrder === 'ymd' ? buildCandidate(normalizeYear(rawFirst), second, third, 'ymd') : null,
  ].filter(Boolean);
  const uniqueDates = new Set(candidates.map((candidate) => candidate.catchDate));

  if (uniqueDates.size === 1) {
    const candidate = candidates[0];
    return { ...candidate, dateAmbiguous: false, usedPreferredOrder: false };
  }
  if (uniqueDates.size > 1 && ['mdy', 'dmy', 'ymd'].includes(preferredDateOrder)) {
    const candidate = candidates.find(({ dateOrder }) => dateOrder === preferredDateOrder);
    if (candidate) return { ...candidate, dateAmbiguous: true, usedPreferredOrder: true };
  }
  return emptyResult(uniqueDates.size > 1);
}

module.exports = { parseShinyOcrDate };
