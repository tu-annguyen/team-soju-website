const {
  getCycleWindow,
  getLeaderboardLocationIds,
  getLocationConfig,
  getMinimumFeebasCyclesUntilPossibleWeatherChange,
  getPokeMmoDayWindow,
  getWeatherAreaId,
  getWeatherAreaLocationIds,
} = require('../src/utils/feebas');

describe('Feebas utilities', () => {
  it('aligns cycle windows to the 45 minute reset cadence', () => {
    const firstReset = getCycleWindow(new Date('2026-04-09T20:15:00.000Z'));
    const secondReset = getCycleWindow(new Date('2026-04-09T21:00:00.000Z'));

    expect(firstReset.cycleStart.toISOString()).toBe('2026-04-09T20:15:00.000Z');
    expect(firstReset.cycleEnd.toISOString()).toBe('2026-04-09T21:00:00.000Z');
    expect(secondReset.cycleStart.toISOString()).toBe('2026-04-09T21:00:00.000Z');
    expect(secondReset.cycleEnd.toISOString()).toBe('2026-04-09T21:45:00.000Z');
  });

  it('exposes Route 119 tile definitions', () => {
    const location = getLocationConfig('route-119-main');

    expect(location.displayName).toBe('Route 119, Hoenn');
    expect(location.tiles.length).toBeGreaterThan(0);
    expect(location.tiles[0]).toEqual(expect.objectContaining({
      tileId: expect.any(String),
      row: expect.any(Number),
      col: expect.any(Number),
      label: expect.any(String),
    }));
  });

  it('exposes Route 119 upstream tile definitions with the expected board size', () => {
    const location = getLocationConfig('route-119-upstream');

    expect(location.displayName).toBe('Route 119 Upstream, Hoenn');
    expect(location.rows).toBe(58);
    expect(location.cols).toBe(20);
    expect(location.tiles.length).toBeGreaterThan(0);
  });

  it('exposes Mt. Coronet tile definitions with the expected board size', () => {
    const location = getLocationConfig('mt-coronet');

    expect(location.displayName).toBe('Mt. Coronet, Sinnoh');
    expect(location.rows).toBe(34);
    expect(location.cols).toBe(18);
    expect(location.tiles.length).toBeGreaterThan(0);
  });

  it('combines Route 119 main and upstream leaderboard locations', () => {
    expect(getLeaderboardLocationIds('route-119-main')).toEqual([
      'route-119-main',
      'route-119-upstream',
    ]);
    expect(getLeaderboardLocationIds('route-119-upstream')).toEqual([
      'route-119-main',
      'route-119-upstream',
    ]);
    expect(getLeaderboardLocationIds('mt-coronet')).toEqual(['mt-coronet']);
  });

  it('aligns PokeMMO day windows to six hour server days', () => {
    const firstDay = getPokeMmoDayWindow(new Date('2026-06-30T05:59:59.000Z'));
    const secondDay = getPokeMmoDayWindow(new Date('2026-06-30T06:00:00.000Z'));

    expect(firstDay.dayStart.toISOString()).toBe('2026-06-30T00:00:00.000Z');
    expect(firstDay.dayEnd.toISOString()).toBe('2026-06-30T06:00:00.000Z');
    expect(secondDay.dayStart.toISOString()).toBe('2026-06-30T06:00:00.000Z');
    expect(secondDay.dayEnd.toISOString()).toBe('2026-06-30T12:00:00.000Z');
  });

  it('calculates minimum Feebas cycles until weather can change', () => {
    expect(getMinimumFeebasCyclesUntilPossibleWeatherChange(new Date('2026-06-30T00:00:00.000Z'))).toBe(8);
    expect(getMinimumFeebasCyclesUntilPossibleWeatherChange(new Date('2026-06-30T05:15:00.000Z'))).toBe(1);
    expect(getMinimumFeebasCyclesUntilPossibleWeatherChange(new Date('2026-06-30T06:00:00.000Z'))).toBe(8);
  });

  it('maps Route 119 locations to one shared weather area', () => {
    expect(getWeatherAreaId('route-119-main')).toBe('route-119');
    expect(getWeatherAreaId('route-119-upstream')).toBe('route-119');
    expect(getWeatherAreaId('mt-coronet')).toBeNull();
    expect(getWeatherAreaLocationIds('route-119')).toEqual(['route-119-main', 'route-119-upstream']);
  });
});
