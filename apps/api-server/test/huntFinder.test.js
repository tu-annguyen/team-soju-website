const {
  calculateExperienceMetrics,
  matchesEvYield,
  sortHuntSpots,
} = require('../src/cloudflare/repositories/hunt-finder');
const { huntFinderFilters } = require('../src/cloudflare/routes/hunt-finder-query');
const { handleHuntFinderRoutes } = require('../src/cloudflare/routes/hunt-finder');

describe('Hunt Finder calculations and filtering', () => {
  it('uses midpoint wild levels and one EXP charm multiplier', () => {
    const result = calculateExperienceMetrics([
      { base_exp: 70, min_level: 20, max_level: 22, split: 0.5 },
      { base_exp: 140, min_level: 28, max_level: 30, split: 0.5 },
    ], 1200, 0.25);

    expect(result.averageExp).toBeCloseTo(395);
    expect(result.expPerHour).toBeCloseTo(592500);
  });

  it('adds EXP boosts and the selected charm without compounding them', () => {
    const result = calculateExperienceMetrics([
      { base_exp: 70, min_level: 20, max_level: 20, split: 1 },
    ], 100, 0.5, { expReamplifier: true, expDonator: true, tradeBonus: true });

    expect(result.averageExp).toBe(200);
    expect(result.expPerHour).toBe(39000);
  });

  it('OR-matches selected EV stat and amount pairs', () => {
    const spot = { composition: [
      { ev_attack: 1, ev_speed: 0 },
      { ev_attack: 0, ev_speed: 2 },
    ] };

    expect(matchesEvYield(spot, ['attack'], ['1'])).toBe(true);
    expect(matchesEvYield(spot, ['attack', 'speed'], ['2'])).toBe(true);
    expect(matchesEvYield(spot, ['speed'], ['1'])).toBe(false);
  });

  it('sorts both metric directions, keeps nulls last, and sorts alphabetically', () => {
    const spots = [
      { location: 'Celestial Tower', region: 'Unova', pointsPerHour: null, expPerHour: 500 },
      { location: 'Route 12', region: 'Kanto', pointsPerHour: 2, expPerHour: 100 },
      { location: 'Abundant Shrine', region: 'Unova', pointsPerHour: 1, expPerHour: 300 },
    ];
    sortHuntSpots(spots, { sort: 'pointsPerHour', sortDirection: 'asc', method: 'Sweet Scent' }, true);
    expect(spots.map(({ location }) => location)).toEqual(['Abundant Shrine', 'Route 12', 'Celestial Tower']);
    sortHuntSpots(spots, { sort: 'expPerHour', sortDirection: 'desc', method: 'Sweet Scent' }, true);
    expect(spots.map(({ expPerHour }) => expPerHour)).toEqual([500, 300, 100]);
    sortHuntSpots(spots, { sort: 'alphabetical', sortDirection: 'desc', method: 'All' }, true);
    expect(spots.map(({ location }) => location)).toEqual(['Route 12', 'Celestial Tower', 'Abundant Shrine']);
  });
});

describe('Hunt Finder public API', () => {
  it('parses generalized filters without accepting war-only state', () => {
    const url = new URL('https://example.test/api/hunt-finder/spots?method=Sweet%20Scent&minLevel=30&evStats=attack,speed&evAmounts=1,2&sort=expPerHour&sortDirection=asc&expCharm=0.5&expReamplifier=true&expDonator=true&tradeBonus=true&eventBoost=true&officialUniqueBonus=true&officialCaughtFamilyKeys=vulpix');
    const filters = huntFinderFilters(url);

    expect(filters).toMatchObject({
      method: 'Sweet Scent', minLevel: '30', evStats: ['attack', 'speed'],
      evAmounts: ['1'], sort: 'expPerHour', sortDirection: 'asc', expCharm: 0.5,
      expReamplifier: true, expDonator: true, tradeBonus: true,
      profile: { eventBoost: true },
    });
    expect(filters.officialUniqueBonus).toBeUndefined();
    expect(filters.officialCaughtFamilyKeys).toBeUndefined();
  });

  it('serves spots without invoking an auth guard', async () => {
    const listHordeSpots = jest.fn().mockResolvedValue({ items: [], total: 0, locations: [] });
    const response = await handleHuntFinderRoutes({
      request: new Request('https://example.test/api/hunt-finder/spots'),
      url: new URL('https://example.test/api/hunt-finder/spots'),
      pathname: '/api/hunt-finder/spots',
      getRepositories: () => ({ shinyWar: { listHordeSpots } }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('public');
    expect(listHordeSpots).toHaveBeenCalledWith(expect.objectContaining({
      sort: 'alphabetical', sortDirection: 'asc', profile: expect.objectContaining({ eventBoost: false }),
    }));
  });
});
