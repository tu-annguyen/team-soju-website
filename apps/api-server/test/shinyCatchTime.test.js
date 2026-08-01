const {
  extractLocalTimeFromOcr,
  getFallbackLocalDate,
  isValidTimezone,
  localCatchDateTimeToUtc,
  normalizeTimezoneInput,
} = require('../src/utils/shinyCatchTime');

describe('shiny catch time', () => {
  it.each([
    ['2026-03-21, 3:03 PM', '15:03'],
    ['16/03/2026, 14:08', '14:08'],
    ['21.05.26, 16:38', '16:38'],
    ['21,05,26, 16:38', '16:38'],
    ['210526, 16:38', '16:38'],
    ['3/7/26,4:49 AM', '04:49'],
  ])('extracts local time from %s', (ocrText, expected) => {
    expect(extractLocalTimeFromOcr(ocrText)).toBe(expected);
  });

  it('converts the OCR local date and time through its IANA timezone', () => {
    expect(localCatchDateTimeToUtc(
      '2026-08-01',
      '20:30',
      'America/Los_Angeles'
    )).toBe('2026-08-02T03:30:00.000Z');
  });

  it('uses the selected timezone when falling back to the command date', () => {
    expect(getFallbackLocalDate('2026-08-02T02:00:00.000Z', 'America/Los_Angeles'))
      .toBe('2026-08-01');
  });

  it('validates IANA timezone names', () => {
    expect(isValidTimezone('America/Los_Angeles')).toBe(true);
    expect(isValidTimezone('Australia/Melbourne (UTC+10)')).toBe(true);
    expect(isValidTimezone('Definitely/Not_A_Zone')).toBe(false);
  });

  it('normalizes an autocomplete display label to its IANA timezone', () => {
    expect(normalizeTimezoneInput('Australia/Melbourne (UTC+10)'))
      .toBe('Australia/Melbourne');
  });
});
