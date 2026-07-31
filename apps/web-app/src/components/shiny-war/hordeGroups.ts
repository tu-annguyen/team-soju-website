import type { HordeSpot, PokemonHordeGroup } from './types';

export function groupHordeSpotsByPokemon(
  spots: HordeSpot[],
  speciesFilter = ''
): PokemonHordeGroup[] {
  const groups = new Map<string, PokemonHordeGroup>();
  const normalizedFilter = speciesFilter.trim().toLowerCase();

  spots.forEach((spot) => {
    spot.composition.forEach((species) => {
      if (normalizedFilter && !species.name.toLowerCase().includes(normalizedFilter)) return;

      const key = `${species.slug}|${species.form || ''}`;
      const group = groups.get(key);
      if (group) {
        group.spots.push(spot);
      } else {
        groups.set(key, { species, spots: [spot] });
      }
    });
  });

  return [...groups.values()].sort((left, right) => {
    const leftBestRate = Math.max(...left.spots.map((spot) => spot.pointsPerHour));
    const rightBestRate = Math.max(...right.spots.map((spot) => spot.pointsPerHour));
    return rightBestRate - leftBestRate || left.species.name.localeCompare(right.species.name);
  });
}
