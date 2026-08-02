const DEFAULT_TIMEZONE = 'America/New_York';

function getSupportedTimezones() {
  return typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : [DEFAULT_TIMEZONE, 'America/Los_Angeles', 'UTC', 'Europe/London', 'Asia/Tokyo'];
}

function getTimezoneOptions(now = new Date()) {
  return getSupportedTimezones().map((zone) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
    }).formatToParts(now);
    const offset = parts.find((part) => part.type === 'timeZoneName')?.value || 'GMT';

    return {
      value: zone,
      label: `${zone} (${offset.replace('GMT', 'UTC')})`,
    };
  });
}

function normalizeTimezoneInput(value) {
  const rawValue = String(value || '').trim();
  const timezone = rawValue.replace(
    /\s+\(UTC(?:[+-]\d{1,2}(?::\d{2})?)?\)$/i,
    ''
  );

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return timezone;
  } catch {
    return null;
  }
}

function getDateTimePartsInZone(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
}

function getTimezoneOffsetMs(date, timezone) {
  const parts = getDateTimePartsInZone(date, timezone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return representedAsUtc - date.getTime();
}

function zonedLocalDateTimeToUtc(value, timezone) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || ''));
  if (!match) throw new Error('Local capture date and time must use YYYY-MM-DDTHH:MM.');

  const [, year, month, day, hour, minute, second = '00'] = match;
  const localAsUtc = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  const firstPass = new Date(localAsUtc - getTimezoneOffsetMs(new Date(localAsUtc), timezone));
  const secondPass = new Date(localAsUtc - getTimezoneOffsetMs(firstPass, timezone));

  const localParts = getDateTimePartsInZone(secondPass, timezone);
  const expected = [year, month, day, hour, minute, second].map(Number);
  const actual = [
    localParts.year,
    localParts.month,
    localParts.day,
    localParts.hour,
    localParts.minute,
    localParts.second,
  ];
  if (!actual.every((part, index) => part === expected[index])) {
    throw new Error('The local capture time does not exist in the selected timezone.');
  }

  return secondPass.toISOString();
}

function getDateInTimezone(value, timezone) {
  const parts = getDateTimePartsInZone(new Date(value), timezone);
  return [parts.year, parts.month, parts.day]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
    .join('-');
}

function getTimeInTimezone(value, timezone) {
  const parts = getDateTimePartsInZone(new Date(value), timezone);
  return [parts.hour, parts.minute].map((part) => String(part).padStart(2, '0')).join(':');
}

module.exports = {
  DEFAULT_TIMEZONE,
  getDateInTimezone,
  getSupportedTimezones,
  getTimeInTimezone,
  getTimezoneOptions,
  normalizeTimezoneInput,
  zonedLocalDateTimeToUtc,
};
