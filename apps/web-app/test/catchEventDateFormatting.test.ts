import {
  formatDateTime,
  formatEventTimeForBrowser,
  formatLocalDateTime,
} from '../src/components/catch-events/shared';

describe('catch event date formatting', () => {
  it('normalizes event start and end dates by locale', () => {
    expect(formatLocalDateTime('2026-05-20T10:00', 'en')).toBe('2026-05-20 10:00');
    expect(formatLocalDateTime('2026-05-20T10:00', 'es')).toBe('2026-05-20 10:00');
    expect(formatLocalDateTime('2026-05-20T10:00', 'zh')).toBe('2026年05月20日 10:00');
  });

  it('uses written month names for browser event times outside zh', () => {
    expect(formatEventTimeForBrowser('2026-05-20T10:00', 'America/Los_Angeles', 'UTC', 'en')).toContain('May 20, 2026');
    expect(formatEventTimeForBrowser('2022-08-08T10:00', 'UTC', 'UTC', 'es')).toContain('ocho de agosto de 2022');
  });

  it('keeps numeric zh dates for browser event times', () => {
    expect(formatEventTimeForBrowser('2026-05-20T10:00', 'America/Los_Angeles', 'UTC', 'zh')).toContain('2026年05月20日');
  });

  it('localizes month names when full date-time text is used', () => {
    expect(formatDateTime('2026-05-20T17:00:00Z', 'UTC', 'en')).toContain('May');
    expect(formatDateTime('2026-05-20T17:00:00Z', 'UTC', 'es').toLowerCase()).toContain('may');
    expect(formatDateTime('2026-05-20T17:00:00Z', 'UTC', 'zh')).toContain('5月');
  });
});
