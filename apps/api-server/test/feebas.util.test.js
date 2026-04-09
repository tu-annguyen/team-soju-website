const {
  FeebasRuleError,
  getCycleWindow,
  getLocationConfig,
  validateTransition,
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

  it('enforces valid state transitions', () => {
    expect(() => validateTransition('unchecked', 'checked')).not.toThrow();
    expect(() => validateTransition('checked', 'pending')).not.toThrow();
    expect(() => validateTransition('pending', 'confirmed')).not.toThrow();
    expect(() => validateTransition('checked', 'confirmed')).toThrow(FeebasRuleError);
    expect(() => validateTransition('confirmed', 'unchecked')).toThrow(FeebasRuleError);
  });
});
