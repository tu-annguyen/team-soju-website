import { groupHordeSpotsByPokemon } from '../src/components/shiny-war/hordeGroups';
import type { HordeSpot } from '../src/components/shiny-war/types';

const species = {
  name: 'Vulpix', slug: 'vulpix', family_key: 'vulpix', tier: 'Tier 3',
  points: 30, split: 1, form: '', min_level: 20, max_level: 22,
};

const makeSpot = (spot_key: string, location: string): HordeSpot => ({
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

describe('groupHordeSpotsByPokemon', () => {
  it('keeps every location and its metrics under the species', () => {
    const groups = groupHordeSpotsByPokemon([
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

    const groups = groupHordeSpotsByPokemon([mixedSpot], 'vul');

    expect(groups.map(({ species: entry }) => entry.name)).toEqual(['Vulpix']);
    expect(groups[0].spots[0].composition).toHaveLength(2);
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

    const groups = groupHordeSpotsByPokemon([mixedSpot, bestVulpixSpot]);

    expect(groups.map(({ species: entry }) => entry.name)).toEqual(['Vulpix', 'Grimer', 'Pikachu']);
  });
});
