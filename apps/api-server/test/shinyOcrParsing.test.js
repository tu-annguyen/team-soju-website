const shiniesRouter = require('../src/routes/shinies');

describe('shiny OCR parsing', () => {
  it('prefers OCR encounter values when mobile encounter confidence is worse', () => {
    const ocrText = [
      'Shiny Woobat was caught by Pokio! 3/21/26, 3:03 PM',
      '[U=: 24/21/21/13/21 Total BEncounter=: 7230',
      'Mature: Naughty lloobat Encounters: £857',
      'I=: Z24/21°21-13/271 Total Encounters: 27230',
      'Mature: Maughty lloobat Encounters: 2257',
    ].join('\n');

    const parsed = shiniesRouter._test.parseDataFromOcr(ocrText);
    const merged = shiniesRouter._test.mergeParsedStats(parsed, {
      totalEncounters: 10751,
      speciesEncounters: 10751,
      meta: {
        recognizers: {
          totalEncounters: { confidence: 0.6472222222222221 },
          speciesEncounters: { confidence: 0.6472222222222221 },
          nature: { confidence: 0.7142857142857143 },
        },
      },
    });

    expect(parsed.totalEncounters).toBe(27230);
    expect(parsed.speciesEncounters).toBe(2857);
    expect(merged.totalEncounters).toBe(27230);
    expect(merged.speciesEncounters).toBe(2857);
  });

  it('does not pull encounter values from IV noise on labeled OCR lines', () => {
    const ocrText = [
      'Shiny Golett was caught by TMAvatar! 3/7/26,4:49 PM',
      'I=: 1271757311621 Total Encounters: 13-51 |',
      'Mature: Quiet Golett Encounters: 4757 |',
      'I=: 1271721771621 Total Encounters: 13°51',
      'Mature: ulet Golett Encounters: 4°57 |',
    ].join('\n');

    const parsed = shiniesRouter._test.parseDataFromOcr(ocrText);
    const merged = shiniesRouter._test.mergeParsedStats(parsed, {
      totalEncounters: 13751,
      speciesEncounters: 4757,
      meta: {
        recognizers: {
          totalEncounters: { confidence: 0.8905000000000001 },
          speciesEncounters: { confidence: 0.7255 },
          nature: { confidence: 0 },
        },
      },
    });

    expect(parsed.totalEncounters).toBe(1351);
    expect(parsed.speciesEncounters).toBe(4757);
    expect(merged.totalEncounters).toBe(13751);
    expect(merged.speciesEncounters).toBe(4757);
  });

  it('does not let conflicting OCR encounter values override a stronger mobile parse', () => {
    const ocrText = [
      'Shiny Sneasel was caught by Llensjo! 16/03/26, 14:08',
      'IU=: 23/10/7158-22-16/21 Total Encounters: 126833 "',
      'Mature: Maughty Sneasel Encounters: 11320',
      'I=: 23/10/1827 16/21 Total Encounters: 128353 -',
      'Mature: HNaughty Sneasel Encounters: 11330',
    ].join('\n');

    const parsed = shiniesRouter._test.parseDataFromOcr(ocrText);
    const merged = shiniesRouter._test.mergeParsedStats(parsed, {
      totalEncounters: 12633,
      speciesEncounters: 1149,
      meta: {
        recognizers: {
          totalEncounters: { confidence: 0.9 },
          speciesEncounters: { confidence: 0.72 },
          nature: { confidence: 0.625 },
        },
      },
    });

    expect(parsed.totalEncounters).toBe(126833);
    expect(parsed.speciesEncounters).toBe(11320);
    expect(parsed.totalEncountersConfidence).toBeCloseTo(0.82, 5);
    expect(parsed.speciesEncountersConfidence).toBeCloseTo(0.66, 5);
    expect(merged.totalEncounters).toBe(12633);
    expect(merged.speciesEncounters).toBe(1149);
  });

  it('parses YYYY-MM-DD dates directly from OCR', () => {
    const parsed = shiniesRouter._test.parseDataFromOcr('Shiny Woobat was caught by Pokio! 2026-03-21, 3:03 PM');

    expect(parsed.date).toBe('2026-03-21');
  });

  it('parses DD/MM/YYYY when the day makes the format unambiguous', () => {
    const parsed = shiniesRouter._test.parseDataFromOcr('Shiny Sneasel was caught by Llensjo! 16/03/2026, 14:08');

    expect(parsed.date).toBe('2026-03-16');
  });

  it('flags ambiguous slash dates instead of guessing them', () => {
    const parsed = shiniesRouter._test.parseDataFromOcr('Shiny Woobat was caught by Pokio! 03/04/26, 3:03 PM');

    expect(parsed.date).toBeNull();
    expect(parsed.dateWasAmbiguous).toBe(true);
  });
});
