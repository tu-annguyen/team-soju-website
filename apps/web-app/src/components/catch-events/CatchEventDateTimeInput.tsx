import React from 'react';
import Flatpickr from 'react-flatpickr';
import flatpickr from 'flatpickr';
import type { Options } from 'flatpickr/dist/types/options';
import { fieldClasses } from './shared';

const FLATPICKR_DATE_FORMAT = 'M j, Y H:i:S';
export const CATCH_EVENT_DATETIME_PLACEHOLDER = 'May 23, 2026 02:20:58';
const monthIndexes = new Map([
  ['jan', 1],
  ['january', 1],
  ['feb', 2],
  ['february', 2],
  ['mar', 3],
  ['march', 3],
  ['apr', 4],
  ['april', 4],
  ['may', 5],
  ['jun', 6],
  ['june', 6],
  ['jul', 7],
  ['july', 7],
  ['aug', 8],
  ['august', 8],
  ['sep', 9],
  ['september', 9],
  ['oct', 10],
  ['october', 10],
  ['nov', 11],
  ['november', 11],
  ['dec', 12],
  ['december', 12],
]);

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
};

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

export function catchEventDateTimeValueToDisplay(value: string) {
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

  return flatpickr.formatDate(date, FLATPICKR_DATE_FORMAT);
}

export function catchEventDateTimeDisplayToValue(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return '';

  const match = trimmedValue.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  const month = match ? monthIndexes.get(match[1].toLowerCase()) : undefined;
  if (!match || !month) return trimmedValue.replace(/\s+/, 'T');

  const [, , day, year, hour, minute, second] = match;
  return `${year}-${padDatePart(month)}-${padDatePart(Number(day))}T${hour}:${minute}:${second}`;
}

export function CatchEventDateTimeInput({
  value,
  onChange,
  placeholder = CATCH_EVENT_DATETIME_PLACEHOLDER,
  required = false,
  className = fieldClasses,
  ariaLabel,
}: Props) {
  const options = React.useMemo<Options>(() => ({
    allowInput: true,
    dateFormat: FLATPICKR_DATE_FORMAT,
    enableSeconds: true,
    enableTime: true,
    time_24hr: true,
  }), []);
  const displayValue = catchEventDateTimeValueToDisplay(value);
  const handleValueUpdate = React.useCallback((_: Date[], dateStr: string) => {
    onChange(catchEventDateTimeDisplayToValue(dateStr));
  }, [onChange]);

  return (
    <Flatpickr
      aria-label={ariaLabel}
      className={className}
      options={options}
      placeholder={placeholder}
      required={required}
      value={displayValue}
      onChange={handleValueUpdate}
      onValueUpdate={handleValueUpdate}
    />
  );
}
