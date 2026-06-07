import {
  catchEventDateTimeDisplayToValue,
  catchEventDateTimeValueToDisplay,
} from '../src/components/catch-events/CatchEventDateTimeInput';

describe('CatchEventDateTimeInput formatting', () => {
  it('formats catch event local values with Flatpickr month-day display', () => {
    expect(catchEventDateTimeValueToDisplay('2026-05-23T02:20:58')).toBe(
      'May 23, 2026 2:20:58 AM'
    );
  });

  it('converts displayed Flatpickr values back to datetime-local storage format', () => {
    expect(catchEventDateTimeDisplayToValue('May 23, 2026 02:20:58')).toBe(
      '2026-05-23T02:20:58'
    );
  });

  it('converts US-style OCR date-time values with seconds and meridiem', () => {
    expect(catchEventDateTimeDisplayToValue('6/6/26 7:26:19 PM')).toBe(
      '2026-06-06T19:26:19'
    );
  });

  it('converts zero-padded OCR date-time values with lowercase meridiem', () => {
    expect(catchEventDateTimeDisplayToValue('06/06/26 7:47:40 pm')).toBe(
      '2026-06-06T19:47:40'
    );
  });

  it('converts OCR ISO date-time values with a space and meridiem', () => {
    expect(catchEventDateTimeDisplayToValue('2026-06-07 10:40:05 AM')).toBe(
      '2026-06-07T10:40:05'
    );
  });

  it('preserves seconds when converting display values', () => {
    expect(catchEventDateTimeDisplayToValue('Apr 7, 2026 09:04:05')).toBe(
      '2026-04-07T09:04:05'
    );
  });

  it('formats month names with the Spanish Flatpickr locale', () => {
    expect(catchEventDateTimeValueToDisplay('2026-04-07T09:04:05', 'es')).toBe(
      'Abr 7, 2026 9:04:05 AM'
    );
  });

  it('parses Spanish month names with Flatpickr parseDate', () => {
    expect(catchEventDateTimeDisplayToValue('Abr 7, 2026 09:04:05', 'es')).toBe(
      '2026-04-07T09:04:05'
    );
  });

  it('formats and parses Chinese month names with the Mandarin Flatpickr locale', () => {
    expect(catchEventDateTimeValueToDisplay('2026-04-07T09:04:05', 'zh')).toBe(
      '四月 7, 2026 9:04:05 AM'
    );
    expect(catchEventDateTimeDisplayToValue('四月 7, 2026 09:04:05', 'zh')).toBe(
      '2026-04-07T09:04:05'
    );
  });
});
