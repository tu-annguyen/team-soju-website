const {
  cleanMethod,
  isLureEncounter,
  isSpecialEncounter,
  normalizePokedex,
  stripInvalidJsonControlCharacters,
  toSql,
} = require('../src/scripts/import-shiny-war-dex');

describe('Shiny Wars Pokedex importer', () => {
  const monsters = [
    {
      id: 19,
      name: 'Rattata',
      catch_rate: 255,
      yields: {
        exp: 51, ev_hp: 0, ev_attack: 0, ev_defense: 0,
        ev_sp_attack: 0, ev_sp_defense: 0, ev_speed: 1,
      },
      egg_groups: ['Field', { name: 'water-1' }, 'Undiscovered'],
      evolutions: [{ id: 20, name: 'Raticate' }],
      locations: [{
        form: '',
        type: 'Grass',
        region_id: 0,
        region_name: '[ Kanto ]\n▁▁',
        location_id: 1,
        location_name_full: 'Route 1',
        min_level: 2,
        max_level: 3,
        season: 'Summer',
        is_horde_3x: true,
        is_horde_5x: false,
        rarity_morning: '2.5%',
        rarity_day: '2.5%',
        rarity_night: '--',
      }],
    },
    { id: 20, name: 'Raticate', evolutions: [], locations: [] },
  ];

  it('sanitizes invalid JSON controls only inside strings', () => {
    const parsed = JSON.parse(stripInvalidJsonControlCharacters('[{"name":"Bad\fName"}]'));
    expect(parsed[0].name).toBe('Bad Name');
  });

  it('normalizes methods, families, locations, and rates', () => {
    const data = normalizePokedex(monsters);
    expect(cleanMethod('ꀀSuper Rod')).toBe('Super Rod');
    expect(data.species[0]).toMatchObject({
      slug: 'rattata', familyKey: 'rattata', points: 3,
      baseExp: 51, evSpeed: 1, evAttack: 0, eggGroups: ['Water A', 'Field'],
    });
    expect(data.species[1].familyKey).toBe('rattata');
    expect(data.locations[0]).toMatchObject({ id: '0:1', region: 'Kanto' });
    expect(data.encounters[0]).toMatchObject({ hordeSize: 3, morningRate: 2.5 });
    expect(toSql(data)).toContain('INSERT INTO pokedex_encounters');
    expect(toSql(data)).toContain('base_exp,ev_hp,ev_attack,ev_defense,ev_sp_attack,ev_sp_defense,ev_speed,egg_groups_json');
    expect(toSql(data)).toContain("'[\"Water A\",\"Field\"]'");
  });

  it('defaults missing EXP and EV yields to zero', () => {
    const data = normalizePokedex([{ ...monsters[1], yields: undefined }]);

    expect(data.species[0]).toMatchObject({
      baseExp: 0, evHp: 0, evAttack: 0, evDefense: 0,
      evSpAttack: 0, evSpDefense: 0, evSpeed: 0,
      eggGroups: [],
    });
  });

  it('preserves lure-only encounters and assigns their standard 5% rate', () => {
    const lureLocation = {
      ...monsters[0].locations[0],
      type: 'Grass',
      is_horde_3x: false,
      rarity_morning: 'Lure',
      rarity_day: 'Lure only',
    };
    const data = normalizePokedex([{ ...monsters[0], locations: [lureLocation] }, monsters[1]]);

    expect(isLureEncounter(lureLocation)).toBe(true);
    expect(data.encounters[0]).toMatchObject({ isLure: true, morningRate: 5, dayRate: 5 });
    expect(toSql(data)).toContain(',is_lure,');
  });

  it('does not treat Zorua Illusion horde appearances as lure encounters', () => {
    const zorua = {
      id: 570,
      name: 'Zorua',
      evolutions: [],
      locations: [{
        ...monsters[0].locations[0],
        type: 'Sweet Scent',
        is_horde_3x: true,
        rarity_morning: 'Lure only',
        rarity_day: 'Lure only',
        rarity_night: 'Lure only',
      }],
    };

    const data = normalizePokedex([zorua]);

    expect(data.encounters[0]).toMatchObject({
      speciesId: 570,
      hordeSize: 3,
      isLure: false,
      morningRate: null,
      dayRate: null,
      nightRate: null,
    });
  });

  it('preserves Special encounters without treating them as lures', () => {
    const specialLocation = {
      ...monsters[0].locations[0],
      type: 'Dust Cloud',
      is_horde_3x: false,
      rarity_morning: 'Special',
      rarity_day: 'Special',
      rarity_night: 'Special',
    };
    const data = normalizePokedex([{ ...monsters[0], locations: [specialLocation] }, monsters[1]]);

    expect(isSpecialEncounter(specialLocation)).toBe(true);
    expect(isLureEncounter(specialLocation)).toBe(false);
    expect(data.encounters[0]).toMatchObject({
      isLure: false,
      isSpecial: true,
      morningRate: null,
      dayRate: null,
      nightRate: null,
    });
    expect(toSql(data)).toContain(',is_lure,is_special,');
  });

  it('gives repeated form records unique slugs while retaining one family', () => {
    const data = normalizePokedex([
      {
        id: 479,
        name: 'Rotom',
        forms: [
          { id: 479, name: 'Rotom' },
          { id: 657, name: 'Rotom [Heat Rotom]' },
        ],
        evolutions: [],
        locations: [],
      },
      { id: 657, name: 'Rotom', evolutions: [], locations: [] },
    ]);

    expect(data.species.map((entry) => entry.slug)).toEqual([
      'rotom',
      'rotom-heat-rotom',
    ]);
    expect(new Set(data.species.map((entry) => entry.slug)).size).toBe(2);
    expect(data.species.map((entry) => entry.familyKey)).toEqual(['rotom', 'rotom']);
  });
});
