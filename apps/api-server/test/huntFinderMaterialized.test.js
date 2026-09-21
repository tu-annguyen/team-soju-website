const { createMaterializedHuntFinder } = require('../src/cloudflare/repositories/hunt-finder-materialized');

const spot = {
  spot_key: 'kanto:route-1|Grass|Any|Any|5',
  region: 'Kanto',
  location: 'Route 1',
  method: 'Grass',
  season: 'Any',
  time: 'Any',
  horde_size: 5,
  is_lure: false,
  is_special: false,
  composition: [{
    name: 'Pidgey', slug: 'pidgey', family_key: 'pidgey', tier: 'Tier 1', points: 2,
    rate: 100, split: 1, min_level: 2, max_level: 4, base_exp: 50,
    ev_hp: 0, ev_attack: 0, ev_defense: 0, ev_sp_attack: 0, ev_sp_defense: 0, ev_speed: 1,
    egg_groups: ['Flying'],
  }],
};

describe('materialized Hunt Finder', () => {
  it('counts and reads only the requested page', async () => {
    const runOne = jest.fn()
      .mockResolvedValueOnce({ count: 100 })
      .mockResolvedValueOnce({ count: 75 });
    const runSelect = jest.fn()
      .mockResolvedValueOnce([{ location: 'Route 1' }])
      .mockResolvedValueOnce([{ spot_json: JSON.stringify(spot) }]);
    const finder = createMaterializedHuntFinder({
      parameter: (index) => `?${index}`,
      runOne,
      runSelect,
    });

    const result = await finder.list({ method: 'Sweet Scent', page: 3, pageSize: 30, sort: 'alphabetical' });

    expect(result).toEqual(expect.objectContaining({ total: 75, page: 3, pageSize: 30, locations: ['Route 1'] }));
    expect(result.items).toHaveLength(1);
    expect(runSelect).toHaveBeenCalledTimes(2);
    expect(runSelect.mock.calls[1][0]).toContain('LIMIT ?1 OFFSET ?2');
    expect(runSelect.mock.calls[1][1].slice(-2)).toEqual([30, 60]);
  });

  it('keeps user-specific Shiny War scoring on the materialized page', async () => {
    const runOne = jest.fn()
      .mockResolvedValueOnce({ count: 100 })
      .mockResolvedValueOnce({ count: 1 });
    const runSelect = jest.fn()
      .mockResolvedValueOnce([{ location: 'Route 1' }])
      .mockResolvedValueOnce([{ spot_json: JSON.stringify(spot) }]);
    const finder = createMaterializedHuntFinder({
      parameter: (index) => `?${index}`,
      runOne,
      runSelect,
    });

    const result = await finder.list({
      officialUniqueBonus: true,
      officialCaughtFamilyKeys: [],
      playerCaughtFamilyKeys: ['pidgey'],
      sort: 'pointsPerHour',
    });

    expect(result.items[0].composition[0].points).toBe(1);
    expect(result.items[0].averagePoints).toBe(9);
    expect(runSelect.mock.calls[1][0]).toContain('hunt_spot_species score_species');
    expect(runSelect.mock.calls[1][0]).toContain('LIMIT');
  });

  it('keeps custom encounter rates on the bounded SQL path', async () => {
    const runOne = jest.fn()
      .mockResolvedValueOnce({ count: 100 })
      .mockResolvedValueOnce({ count: 1 });
    const runSelect = jest.fn()
      .mockResolvedValueOnce([{ location: 'Route 1' }])
      .mockResolvedValueOnce([{ spot_json: JSON.stringify(spot) }]);
    const finder = createMaterializedHuntFinder({
      parameter: (index) => `?${index}`,
      runOne,
      runSelect,
    });

    const result = await finder.list({
      method: 'Sweet Scent',
      encountersPerHour: 300,
      sort: 'expPerHour',
    });

    expect(result).not.toBeNull();
    expect(result.items[0].encountersPerHour).toBe(1500);
    expect(runSelect.mock.calls[1][0]).toContain('NULLIF');
  });

  it('applies both level bounds to every species in a spot', async () => {
    const runOne = jest.fn()
      .mockResolvedValueOnce({ count: 100 })
      .mockResolvedValueOnce({ count: 1 });
    const runSelect = jest.fn()
      .mockResolvedValueOnce([{ location: 'Route 1' }])
      .mockResolvedValueOnce([{ spot_json: JSON.stringify(spot) }]);
    const finder = createMaterializedHuntFinder({
      parameter: (index) => `?${index}`,
      runOne,
      runSelect,
    });

    await finder.list({ minLevel: 2, maxLevel: 4, sort: 'alphabetical' });

    expect(runSelect.mock.calls[1][0]).toContain('hss.min_level < ?1');
    expect(runSelect.mock.calls[1][0]).toContain('hss.max_level <= 0 OR hss.max_level > ?2');
    expect(runSelect.mock.calls[1][1].slice(0, 2)).toEqual([2, 4]);
  });

  it('excludes zero EXP rows when ascending EXP sorting requests it', async () => {
    const runOne = jest.fn()
      .mockResolvedValueOnce({ count: 100 })
      .mockResolvedValueOnce({ count: 1 });
    const runSelect = jest.fn()
      .mockResolvedValueOnce([{ location: 'Route 1' }])
      .mockResolvedValueOnce([{ spot_json: JSON.stringify(spot) }]);
    const finder = createMaterializedHuntFinder({
      parameter: (index) => `?${index}`,
      runOne,
      runSelect,
    });

    await finder.list({
      excludeZeroExp: true, sort: 'expPerHour', sortDirection: 'asc',
    });

    expect(runSelect.mock.calls[1][0]).toContain('COALESCE(');
    expect(runSelect.mock.calls[1][0]).toContain('<> 0');
  });
});
