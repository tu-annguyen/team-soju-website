import { resolveLocale, type Locale } from '../i18n';

type DateOrder = 'mdy' | 'dmy' | 'ymd';

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function inferDateOrder(localeInput: Locale | string = 'en'): DateOrder {
  const locale = resolveLocale(localeInput);

  if (locale === 'es') return 'dmy';
  if (locale === 'zh') return 'ymd';

  return 'mdy';
}

function toYear(value: string) {
  const year = Number(value);
  return year < 100 ? 2000 + year : year;
}

function toHour(value: string, meridiem?: string) {
  let hour = Number(value);
  const normalizedMeridiem = meridiem?.toUpperCase();

  if (normalizedMeridiem === 'PM' && hour < 12) hour += 12;
  if (normalizedMeridiem === 'AM' && hour === 12) hour = 0;

  return hour;
}

function isValidDateTime(year: number, month: number, day: number, hour: number, minute: number, second: number) {
  if (
    month < 1
    || month > 12
    || day < 1
    || day > 31
    || hour < 0
    || hour > 23
    || minute < 0
    || minute > 59
    || second < 0
    || second > 59
  ) {
    return false;
  }

  const date = new Date(year, month - 1, day, hour, minute, second);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    && date.getHours() === hour
    && date.getMinutes() === minute
    && date.getSeconds() === second;
}

function formatDateTime(year: number, month: number, day: number, hour: number, minute: number, second: number) {
  return `${padDatePart(year)}-${padDatePart(month)}-${padDatePart(day)}T${padDatePart(hour)}:${padDatePart(minute)}:${padDatePart(second)}`;
}

function buildDateTime(year: number, month: number, day: number, hour: number, minute: number, second: number) {
  return isValidDateTime(year, month, day, hour, minute, second)
    ? formatDateTime(year, month, day, hour, minute, second)
    : null;
}

export function normalizeCatchEventDateTimeInput(value: string, locale: Locale | string = 'en') {
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text) return '';

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (isoMatch) {
    const [, rawYear, rawMonth, rawDay, rawHour, rawMinute, rawSecond = '00', meridiem] = isoMatch;
    return buildDateTime(
      Number(rawYear),
      Number(rawMonth),
      Number(rawDay),
      toHour(rawHour, meridiem),
      Number(rawMinute),
      Number(rawSecond)
    );
  }

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!slashMatch) return null;

  const [, rawFirst, rawSecondDate, rawYear, rawHour, rawMinute, rawSecond = '00', meridiem] = slashMatch;
  const first = Number(rawFirst);
  const secondDate = Number(rawSecondDate);
  const year = toYear(rawYear);
  const hour = toHour(rawHour, meridiem);
  const minute = Number(rawMinute);
  const second = Number(rawSecond);
  const order = inferDateOrder(locale);
  const inferredOrder = first > 12
    ? 'dmy'
    : secondDate > 12
      ? 'mdy'
      : ['mdy', 'dmy'].includes(order)
        ? order
        : null;

  if (!inferredOrder) return null;

  const month = inferredOrder === 'dmy' ? secondDate : first;
  const day = inferredOrder === 'dmy' ? first : secondDate;

  return buildDateTime(year, month, day, hour, minute, second);
}
