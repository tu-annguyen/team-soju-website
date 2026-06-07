const {
  normalizeCatchEventOcrResult,
} = require('../src/cloudflare/services/worker-support');

describe('catch event OCR date normalization', () => {
  it('uses MM/DD fallback from locale and timezone', () => {
    const result = normalizeCatchEventOcrResult(
      { catchLocal: '7/6/26 10:40:05 AM', confidence: 0.7, warnings: [] },
      'mdy',
      { timezone: 'America/Los_Angeles' }
    );

    expect(result.catchLocal).toBe('2026-07-06T10:40:05');
    expect(result.dateOrder).toBe('mdy');
    expect(result.warnings).toContain('Date order inferred from browser settings as MDY.');
  });

  it('uses DD/MM fallback from locale and timezone', () => {
    const result = normalizeCatchEventOcrResult(
      { catchLocal: '7/6/26 10:40:05 AM', confidence: 0.7, warnings: [] },
      'dmy',
      { timezone: 'Europe/London' }
    );

    expect(result.catchLocal).toBe('2026-06-07T10:40:05');
    expect(result.dateOrder).toBe('dmy');
    expect(result.warnings).toContain('Date order inferred from browser settings as DMY.');
  });

  it('prefers the ambiguous date candidate that falls inside the event window', () => {
    const result = normalizeCatchEventOcrResult(
      { catchLocal: '7/6/26 10:40:05 AM', confidence: 0.7, warnings: [] },
      'mdy',
      {
        timezone: 'America/Los_Angeles',
        eventStartLocal: '2026-06-07T10:00:00',
        eventEndLocal: '2026-06-07T11:00:00',
        eventTimezone: 'America/Los_Angeles',
      }
    );

    expect(result.catchLocal).toBe('2026-06-07T10:40:05');
    expect(result.dateOrder).toBe('dmy');
    expect(result.warnings).toEqual(expect.arrayContaining([
      'Date order inferred from browser settings as MDY.',
      'Ambiguous date matched using the event time window.',
    ]));
  });

  it('parses YYYY-MM-DD OCR values with spaces and meridiem', () => {
    const result = normalizeCatchEventOcrResult(
      { catchLocal: '2026-06-07 10:40:05 AM', confidence: 0.7, warnings: [] },
      'mdy',
      { timezone: 'America/Los_Angeles' }
    );

    expect(result.catchLocal).toBe('2026-06-07T10:40:05');
    expect(result.dateOrder).toBe('ymd');
  });

  it('does not guess ambiguous slash dates from YMD fallback alone', () => {
    const result = normalizeCatchEventOcrResult(
      { catchLocal: '7/6/26 10:40:05 AM', confidence: 0.7, warnings: [] },
      'ymd',
      { timezone: 'Asia/Tokyo' }
    );

    expect(result.catchLocal).toBeNull();
  });

  it('does not autofill invalid calendar dates', () => {
    const result = normalizeCatchEventOcrResult(
      { catchLocal: '2/31/26 10:40:05 AM', confidence: 0.7, warnings: [] },
      'mdy',
      { timezone: 'America/Los_Angeles' }
    );

    expect(result.catchLocal).toBeNull();
  });
});
