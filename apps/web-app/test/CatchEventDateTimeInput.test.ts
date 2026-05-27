import {
  catchEventDateTimeDisplayToValue,
  catchEventDateTimeValueToDisplay,
} from '../src/components/catch-events/CatchEventDateTimeInput';

describe('CatchEventDateTimeInput formatting', () => {
  it('formats catch event local values with Flatpickr month-day display', () => {
    expect(catchEventDateTimeValueToDisplay('2026-05-23T02:20:58')).toBe(
      'May 23, 2026 02:20:58'
    );
  });

  it('converts displayed Flatpickr values back to datetime-local storage format', () => {
    expect(catchEventDateTimeDisplayToValue('May 23, 2026 02:20:58')).toBe(
      '2026-05-23T02:20:58'
    );
  });

  it('preserves seconds when converting display values', () => {
    expect(catchEventDateTimeDisplayToValue('Apr 7, 2026 09:04:05')).toBe(
      '2026-04-07T09:04:05'
    );
  });
});
