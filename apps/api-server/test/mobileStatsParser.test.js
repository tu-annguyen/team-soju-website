const { _test } = require('../src/utils/mobileStatsParser');

function buildMaskFromDigits(text, gap = 3) {
  const rows = _test.NUMERIC_TEMPLATES['0'].length;
  const width = text.split('').reduce((total, char, index) => {
    const glyphWidth = _test.NUMERIC_TEMPLATES[char][0].length;
    return total + glyphWidth + (index === text.length - 1 ? 0 : gap);
  }, 0);

  const mask = Array.from({ length: rows }, () => new Uint8Array(width));
  let offset = 0;

  for (const char of text) {
    const template = _test.NUMERIC_TEMPLATES[char];
    const glyphWidth = template[0].length;

    for (let y = 0; y < template.length; y += 1) {
      for (let x = 0; x < glyphWidth; x += 1) {
        mask[y][offset + x] = template[y][x] === '1' ? 1 : 0;
      }
    }

    offset += glyphWidth + gap;
  }

  return mask;
}

describe('mobileStatsParser encounter recognition', () => {
  it('recognizes a five-digit total encounter count from the pixel font mask', () => {
    const result = _test.recognizeCountFromMask(buildMaskFromDigits('30973'));

    expect(result.value).toBe(30973);
    expect(result.raw).toBe('30973');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('recognizes a four-digit species encounter count from the pixel font mask', () => {
    const result = _test.recognizeCountFromMask(buildMaskFromDigits('1984'));

    expect(result.value).toBe(1984);
    expect(result.raw).toBe('1984');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('prefers the fuller value-region candidate over a truncated trailing crop', () => {
    const best = _test.chooseBestCountCandidate([
      { value: 373, confidence: 0.75, raw: '373', variants: [] },
      { value: 30973, confidence: 0.73, raw: '30973', variants: [] },
    ]);

    expect(best.value).toBe(30973);
    expect(best.raw).toBe('30973');
  });

  it('extracts total encounters from a noisy labeled OCR row', () => {
    const parsed = _test.parseEncounterCountCandidate(
      'Total Encounters: 3O973',
      'total',
      'Pachirisu'
    );

    expect(parsed.value).toBe(30973);
  });

  it('penalizes ambiguous labeled OCR numbers that drop digits during normalization', () => {
    const parsed = _test.parseEncounterCountCandidate(
      'Total Encounters: ZL3A3',
      'total',
      'Pachirisu'
    );

    expect(parsed.value).toBe(2133);
    expect(parsed.confidence).toBeLessThan(0.9);
    expect(parsed.confidence).toBeLessThan(0.82);
  });

  it('extracts species encounters from a noisy labeled OCR row', () => {
    const parsed = _test.parseEncounterCountCandidate(
      'Pachirisu Encounters: l984',
      'species',
      'Pachirisu'
    );

    expect(parsed.value).toBe(1984);
  });
});
