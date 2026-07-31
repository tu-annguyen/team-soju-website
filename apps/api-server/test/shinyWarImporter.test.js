const {
  cleanMethod,
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
    expect(data.species[0]).toMatchObject({ slug: 'rattata', familyKey: 'rattata', points: 3 });
    expect(data.species[1].familyKey).toBe('rattata');
    expect(data.locations[0]).toMatchObject({ id: '0:1', region: 'Kanto' });
    expect(data.encounters[0]).toMatchObject({ hordeSize: 3, morningRate: 2.5 });
    expect(toSql(data)).toContain('INSERT INTO pokedex_encounters');
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
