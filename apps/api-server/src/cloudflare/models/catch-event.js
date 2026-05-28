const pokemonNatures = new Set([
  'hardy', 'lonely', 'brave', 'adamant', 'naughty',
  'bold', 'docile', 'relaxed', 'impish', 'lax',
  'timid', 'hasty', 'serious', 'jolly', 'naive',
  'modest', 'mild', 'quiet', 'bashful', 'rash',
  'calm', 'gentle', 'sassy', 'careful', 'quirky',
]);

function normalizeCatchEventText(value) {
  return String(value || '').trim().toLowerCase();
}

function getDateTimePartsInZone(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function getTimezoneOffsetMs(date, timezone) {
  const parts = getDateTimePartsInZone(date, timezone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function zonedLocalDateTimeToUtc(value, timezone) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    throw new Error('Catch time must use a datetime-local value.');
  }

  const [, year, month, day, hour, minute, second = '0'] = match;
  const localAsUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  const firstPass = new Date(localAsUtc - getTimezoneOffsetMs(new Date(localAsUtc), timezone));
  const secondPass = new Date(localAsUtc - getTimezoneOffsetMs(firstPass, timezone));
  return secondPass.toISOString();
}

function calculateCatchEventScore(submission, event) {
  const species = normalizeCatchEventText(submission.species);
  const nature = normalizeCatchEventText(submission.nature);
  const findPoints = (rules) => (rules || []).find((rule) => normalizeCatchEventText(rule.name) === species)?.points ?? 0;
  const findNaturePoints = (rules) => (rules || []).find((rule) => normalizeCatchEventText(rule.name) === nature)?.points ?? 0;
  return Number(submission.totalIv)
    + findPoints(event.speciesBonuses)
    + findPoints(event.speciesPenalties)
    + findNaturePoints(event.natureBonuses)
    + findNaturePoints(event.naturePenalties);
}

function validateCatchEventSubmissionPayload(input, event) {
  const errors = [];
  const flags = [];
  const targets = (event.targets || []).map(normalizeCatchEventText);

  if (!normalizeCatchEventText(input.playerIgn)) errors.push('Missing OT / IGN');
  if (!targets.includes(normalizeCatchEventText(input.species))) errors.push('Species is not allowed for this event');
  if (Number(input.totalIv) < 0 || Number(input.totalIv) > 186) errors.push('Total IV must be between 0 and 186');
  if (!pokemonNatures.has(normalizeCatchEventText(input.nature))) errors.push('Nature is not one of the standard Pokemon natures');
  if (!normalizeCatchEventText(input.region)) {
    errors.push('Missing catch region');
  } else if (normalizeCatchEventText(input.region) !== normalizeCatchEventText(event.region)) {
    errors.push('Catch region differs from event location');
  }
  if (!normalizeCatchEventText(input.route)) {
    errors.push('Missing catch route/location');
  } else if (normalizeCatchEventText(input.route) !== normalizeCatchEventText(event.route)) {
    errors.push('Catch route/location differs from event location');
  }

  let catchUtc = '';
  try {
    catchUtc = zonedLocalDateTimeToUtc(input.catchLocal, input.timezone);
    const startUtc = zonedLocalDateTimeToUtc(event.startLocal, event.timezone);
    const endUtc = zonedLocalDateTimeToUtc(event.endLocal, event.timezone);
    if (catchUtc < startUtc || catchUtc > endUtc) {
      errors.push('Catch time is outside the event window');
    }
  } catch {
    errors.push('Catch time or timezone could not be parsed');
  }

  return {
    catchUtc,
    errors,
    flags,
    score: calculateCatchEventScore(input, event),
    status: event.autoCheckEnabled
      ? 'auto-checked'
      : 'pending-verification',
  };
}

module.exports = {
  calculateCatchEventScore,
  getDateTimePartsInZone,
  getTimezoneOffsetMs,
  normalizeCatchEventText,
  pokemonNatures,
  validateCatchEventSubmissionPayload,
  zonedLocalDateTimeToUtc,
};
