const {
  getDateInTimezone,
  normalizeTimezoneInput,
  zonedLocalDateTimeToUtc,
} = require('@team-soju/utils');

const DATE_TOKEN = String.raw`(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[/.]\d{1,2}[/.]\d{2,4}|\d{1,2},\d{1,2},\d{2,4}|\d{6}|\d{8})`;
const TIME_AFTER_DATE_PATTERN = new RegExp(
  String.raw`\b${DATE_TOKEN}\s*,?\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?\b`,
  'i'
);

function extractLocalTimeFromOcr(text) {
  const match = TIME_AFTER_DATE_PATTERN.exec(String(text || ''));
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (minute > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (hour === 12) hour = 0;
    if (meridiem === 'PM') hour += 12;
  } else if (hour > 23) {
    return null;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function getFallbackLocalDate(commandCalledAt, timezone) {
  return getDateInTimezone(commandCalledAt || new Date(), timezone);
}

function localCatchDateTimeToUtc(date, time, timezone) {
  return zonedLocalDateTimeToUtc(`${date}T${time}:00`, timezone);
}

function isValidTimezone(timezone) {
  return Boolean(normalizeTimezoneInput(timezone));
}

module.exports = {
  extractLocalTimeFromOcr,
  getFallbackLocalDate,
  isValidTimezone,
  localCatchDateTimeToUtc,
  normalizeTimezoneInput,
};
