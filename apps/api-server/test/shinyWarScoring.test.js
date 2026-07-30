const {
  calculateHordeMetrics,
  effectiveShinyDenominator,
  getShinyWarSeason,
  scoreShinyWarCatches,
} = require('@team-soju/utils');

describe('Shiny Wars 2026 scoring', () => {
  it('matches the Pokemon Mansion example', () => {
    const metrics = calculateHordeMetrics([
      { pokemon: 'vulpix', points: 30, rate: 2.5 },
      { pokemon: 'grimer', points: 5, rate: 2.5 },
    ], { hordeSize: 5, hordesPerHour: 240, denominator: 30000 });

    expect(metrics.composition.map(({ split }) => split)).toEqual([0.5, 0.5]);
    expect(metrics.averagePoints).toBe(17.5);
    expect(metrics.encountersPerHour).toBe(1200);
    expect(metrics.pointsPerHour).toBe(0.7);
  });

  it('calculates event boost profiles and seasons', () => {
    expect(effectiveShinyDenominator()).toBe(27000);
    expect(effectiveShinyDenominator({ donator: true })).toBe(24000);
    expect(effectiveShinyDenominator({ donator: true, personalCharm: true })).toBe(21000);
    expect(getShinyWarSeason('2026-08-01T00:00:00Z')).toBe('Summer');
    expect(getShinyWarSeason('2026-08-22T00:00:00Z')).toBe('Spring');
    expect(getShinyWarSeason('2026-08-29T00:00:00Z')).toBeNull();
  });

  it('applies unique, duplicate, alpha, secret, safari, and eligibility rules', () => {
    const base = {
      original_trainer: 'p1',
      tier: 'Tier 7',
      family_key: 'rattata',
      status: 'Owned',
      caught_at_utc: '2026-08-02T01:00:00Z',
      created_at: '2026-08-02T01:01:00Z',
    };
    const result = scoreShinyWarCatches([
      { ...base, id: '1', pokemon: 'rattata', is_secret: true },
      { ...base, id: '2', pokemon: 'raticate', caught_at_utc: '2026-08-02T02:00:00Z', encounter_type: 'safari' },
      { ...base, id: '3', pokemon: 'rattata', caught_at_utc: '2026-08-02T03:00:00Z', is_alpha: true },
      { ...base, id: '4', pokemon: 'rattata', status: 'Died', caught_at_utc: '2026-08-02T04:00:00Z' },
      { ...base, id: '5', pokemon: 'rattata', caught_at_utc: '2026-09-02T04:00:00Z' },
    ], ['p1']);

    expect(result.catches.map((entry) => entry.score.total)).toEqual([31, 11, 35]);
    expect(result.teamTotal).toBe(77);
  });

  it('never lets an eligibility override bypass event boundaries', () => {
    const result = scoreShinyWarCatches([{
      id: 'late',
      original_trainer: 'p1',
      pokemon: 'rattata',
      tier: 'Tier 7',
      family_key: 'rattata',
      status: 'Owned',
      caught_at_utc: '2026-08-29T00:00:00Z',
      war_eligibility_override: true,
    }], ['p1']);

    expect(result.teamTotal).toBe(0);
  });
});
