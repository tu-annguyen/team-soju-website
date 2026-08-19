const { parseShinyOcrDate } = require('../src/cloudflare/services/shiny-ocr-date');

describe('shiny screenshot OCR date parsing', () => {
  it.each([
    ['8/18/26', 'dmy', '2026-08-18', 'mdy'],
    ['18/8/26', 'mdy', '2026-08-18', 'dmy'],
    ['2026-08-18', 'dmy', '2026-08-18', 'ymd'],
    ['21.05.26', 'mdy', '2026-05-21', 'dmy'],
    ['21,05,26', 'mdy', '2026-05-21', 'dmy'],
    ['210526', 'mdy', '2026-05-21', 'dmy'],
  ])('uses the only valid interpretation for %s', (value, preferredOrder, catchDate, dateOrder) => {
    expect(parseShinyOcrDate(value, preferredOrder)).toEqual({
      catchDate,
      dateOrder,
      dateAmbiguous: false,
      usedPreferredOrder: false,
    });
  });

  it.each([
    ['mdy', '2026-03-04'],
    ['dmy', '2026-04-03'],
  ])('uses the preferred date order %s when both interpretations are valid', (preferredOrder, catchDate) => {
    expect(parseShinyOcrDate('3/4/26', preferredOrder)).toEqual({
      catchDate,
      dateOrder: preferredOrder,
      dateAmbiguous: true,
      usedPreferredOrder: true,
    });
  });

  it('does not force a slash-date order when no MDY or DMY preference exists', () => {
    expect(parseShinyOcrDate('3/4/26', 'ymd')).toEqual({
      catchDate: null,
      dateOrder: null,
      dateAmbiguous: true,
      usedPreferredOrder: false,
    });
  });

  it('rejects impossible calendar dates', () => {
    expect(parseShinyOcrDate('2/31/26', 'mdy')).toEqual({
      catchDate: null,
      dateOrder: null,
      dateAmbiguous: false,
      usedPreferredOrder: false,
    });
  });

  it('supports an explicit two-digit YMD date order', () => {
    expect(parseShinyOcrDate('26/08/18', 'ymd')).toEqual({
      catchDate: '2026-08-18',
      dateOrder: 'ymd',
      dateAmbiguous: true,
      usedPreferredOrder: true,
    });
  });
});
