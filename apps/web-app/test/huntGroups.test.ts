import { groupHuntSpotsByPokemon } from '../src/components/shiny-war/huntGroups';
import type { HuntSpot } from '../src/components/shiny-war/types';

const species = {
  name: 'Vulpix', slug: 'vulpix', family_key: 'vulpix', tier: 'Tier 3',
  points: 30, split: 1, form: '', min_level: 20, max_level: 22,
};

const makeSpot = (spot_key: string, location: string): HuntSpot => ({
  spot_key,
  location,
  region: 'Kanto',
  method: 'Sweet Scent',
  season: 'Summer',
  time: 'day',
  horde_size: 5,
  denominator: 30000,
  averagePoints: 30,
  encountersPerHour: 1200,
  pointsPerHour: 1.2,
  composition: [species],
});

describe('groupHuntSpotsByPokemon', () => {
  it('keeps every location and its metrics under the species', () => {
    const groups = groupHuntSpotsByPokemon([
      makeSpot('mansion', 'Pokemon Mansion 2F'),
      { ...makeSpot('route', 'Route 7'), pointsPerHour: 0.8, averagePoints: 22 },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].species.name).toBe('Vulpix');
    expect(groups[0].spots.map(({ location }) => location)).toEqual(['Pokemon Mansion 2F', 'Route 7']);
    expect(groups[0].spots.map(({ pointsPerHour }) => pointsPerHour)).toEqual([1.2, 0.8]);
  });

  it('only creates the searched Pokémon group while retaining mixed location data', () => {
    const mixedSpot = makeSpot('mansion', 'Pokemon Mansion 2F');
    mixedSpot.composition = [
      { ...species, split: 0.5 },
      { ...species, name: 'Grimer', slug: 'grimer', family_key: 'grimer', split: 0.5 },
    ];

    const groups = groupHuntSpotsByPokemon([mixedSpot], 'vul');

    expect(groups.map(({ species: entry }) => entry.name)).toEqual(['Vulpix']);
    expect(groups[0].spots[0].composition).toHaveLength(2);
  });

  it('excludes Pokémon groups below the minimum tier without changing split compositions', () => {
    const mixedSpot = makeSpot('mansion', 'Pokemon Mansion 2F');
    mixedSpot.composition = [
      { ...species, split: 0.5 },
      {
        ...species, name: 'Grimer', slug: 'grimer', family_key: 'grimer',
        tier: 'Tier 6', points: 5, split: 0.5,
      },
    ];

    const groups = groupHuntSpotsByPokemon([mixedSpot], '', '3');

    expect(groups.map(({ species: entry }) => entry.name)).toEqual(['Vulpix']);
    expect(groups[0].spots[0].composition.map((entry) => entry.name)).toEqual(['Vulpix', 'Grimer']);
  });

  it('sorts Pokémon by their best points/hour location, then by name', () => {
    const bestVulpixSpot = makeSpot('mansion', 'Pokemon Mansion 2F');
    bestVulpixSpot.pointsPerHour = 1.2;
    const mixedSpot = makeSpot('forest', 'Viridian Forest');
    mixedSpot.pointsPerHour = 0.9;
    mixedSpot.composition = [
      { ...species, name: 'Pikachu', slug: 'pikachu', family_key: 'pikachu' },
      { ...species, name: 'Grimer', slug: 'grimer', family_key: 'grimer' },
    ];

    const groups = groupHuntSpotsByPokemon([mixedSpot, bestVulpixSpot]);

    expect(groups.map(({ species: entry }) => entry.name)).toEqual(['Vulpix', 'Grimer', 'Pikachu']);
  });

  it('sorts Pokémon without hourly data by point potential', () => {
    const lowPointSpot = makeSpot('rocks-low', 'Low Point Cave');
    lowPointSpot.pointsPerHour = null;
    lowPointSpot.encountersPerHour = null;
    lowPointSpot.composition = [{ ...species, name: 'Rattata', slug: 'rattata', points: 3 }];
    const highPointSpot = makeSpot('rocks-high', 'High Point Cave');
    highPointSpot.pointsPerHour = null;
    highPointSpot.encountersPerHour = null;
    highPointSpot.composition = [{ ...species, name: 'Vulpix', slug: 'vulpix', points: 30 }];

    const groups = groupHuntSpotsByPokemon([lowPointSpot, highPointSpot]);

    expect(groups.map(({ species: entry }) => entry.name)).toEqual(['Vulpix', 'Rattata']);
  });
});
