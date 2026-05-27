import React from 'react';
import Flatpickr from 'react-flatpickr';
import flatpickr from 'flatpickr';
import type { Options } from 'flatpickr/dist/types/options';
import { Spanish } from 'flatpickr/dist/l10n/es.js';
import { Mandarin } from 'flatpickr/dist/l10n/zh.js';
import type { Locale as FlatpickrLocale } from 'flatpickr/dist/types/locale';
import type { Instance } from 'flatpickr/dist/types/instance';
import { resolveLocale, type Locale } from '../../i18n';
import { fieldClasses } from './shared';

const FLATPICKR_DATE_FORMAT = 'M j, Y H:i:S';
export const CATCH_EVENT_DATETIME_PLACEHOLDER = 'May 23, 2026 02:20:58';

type Props = {
  value: string;
  onChange: (value: string) => void;
  locale?: Locale | string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
};

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function getFlatpickrLocale(localeInput: Locale | string = 'en'): FlatpickrLocale | undefined {
  const locale = resolveLocale(localeInput);

  if (locale === 'es') return Spanish;
  if (locale === 'zh') return Mandarin;

  return undefined;
}

function dateToLocalValue(date: Date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-')
    + `T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:${padDatePart(date.getSeconds())}`;
}

export function catchEventDateTimeValueToDisplay(value: string, locale: Locale | string = 'en') {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return value;

  const [, year, month, day, hour, minute, second = '00'] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  return flatpickr.formatDate(date, FLATPICKR_DATE_FORMAT, getFlatpickrLocale(locale));
}

function createLocalizedParser(locale: Locale | string) {
  if (typeof document === 'undefined') return undefined;

  const input = document.createElement('input');
  const flatpickrLocale = getFlatpickrLocale(locale);
  const instance = flatpickr(input, {
    dateFormat: FLATPICKR_DATE_FORMAT,
    enableSeconds: true,
    enableTime: true,
    ...(flatpickrLocale ? { locale: flatpickrLocale } : {}),
    time_24hr: true,
  });

  return {
    parseDate: instance.parseDate.bind(instance),
    destroy: () => instance.destroy(),
  };
}

export function catchEventDateTimeDisplayToValue(
  value: string,
  locale: Locale | string = 'en',
  parseDate?: (date: string, format: string) => Date | undefined
) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return '';

  let parser = parseDate;
  const temporaryParser = parser ? undefined : createLocalizedParser(locale);
  parser = parser || temporaryParser?.parseDate;
  const parsedDate = parser?.(trimmedValue, FLATPICKR_DATE_FORMAT);
  temporaryParser?.destroy();

  return parsedDate ? dateToLocalValue(parsedDate) : trimmedValue.replace(/\s+/, 'T');
}

export function CatchEventDateTimeInput({
  value,
  onChange,
  locale = 'en',
  placeholder = CATCH_EVENT_DATETIME_PLACEHOLDER,
  required = false,
  className = fieldClasses,
  ariaLabel,
}: Props) {
  const flatpickrRef = React.useRef<Instance>();
  const flatpickrLocale = getFlatpickrLocale(locale);
  const options = React.useMemo<Options>(() => ({
    allowInput: true,
    dateFormat: FLATPICKR_DATE_FORMAT,
    enableSeconds: true,
    enableTime: true,
    ...(flatpickrLocale ? { locale: flatpickrLocale } : {}),
    time_24hr: true,
  }), [flatpickrLocale]);
  const displayValue = catchEventDateTimeValueToDisplay(value, locale);
  const handleCreate = React.useCallback((instance?: Instance | null) => {
    flatpickrRef.current = instance || undefined;
  }, []);
  const handleDestroy = React.useCallback(() => {
    flatpickrRef.current = undefined;
  }, []);
  const handleValueUpdate = React.useCallback((_: Date[], dateStr: string) => {
    const parseDate = flatpickrRef.current?.parseDate;
    onChange(catchEventDateTimeDisplayToValue(dateStr, locale, parseDate));
  }, [locale, onChange]);

  return (
    <Flatpickr
      aria-label={ariaLabel}
      className={className}
      options={options}
      placeholder={placeholder}
      required={required}
      value={displayValue}
      onCreate={handleCreate}
      onChange={handleValueUpdate}
      onDestroy={handleDestroy}
      onValueUpdate={handleValueUpdate}
    />
  );
}
