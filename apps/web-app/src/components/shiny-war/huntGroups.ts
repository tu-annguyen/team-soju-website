import type { HuntSpot, PokemonHuntGroup } from './types';

export function groupHuntSpotsByPokemon(
  spots: HuntSpot[],
  speciesFilter = '',
  minimumTier = ''
): PokemonHuntGroup[] {
  const groups = new Map<string, PokemonHuntGroup>();
  const normalizedFilter = speciesFilter.trim().toLowerCase();
  const parsedMinimumTier = Number(minimumTier);
  const hasMinimumTier = minimumTier !== ''
    && Number.isInteger(parsedMinimumTier) && parsedMinimumTier >= 0 && parsedMinimumTier <= 7;

  spots.forEach((spot) => {
    spot.composition.forEach((species) => {
      if (normalizedFilter && !species.name.toLowerCase().includes(normalizedFilter)) return;
      const speciesTier = Number(species.tier.match(/^Tier ([0-7])$/)?.[1]);
      if (hasMinimumTier && (!Number.isInteger(speciesTier) || speciesTier > parsedMinimumTier)) return;

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
    const leftRates = left.spots.flatMap((spot) => spot.pointsPerHour === null ? [] : [spot.pointsPerHour]);
    const rightRates = right.spots.flatMap((spot) => spot.pointsPerHour === null ? [] : [spot.pointsPerHour]);
    if (leftRates.length || rightRates.length) {
      if (!leftRates.length) return 1;
      if (!rightRates.length) return -1;
      const rateDifference = Math.max(...rightRates) - Math.max(...leftRates);
      if (rateDifference) return rateDifference;
    }
    return right.species.points - left.species.points
      || left.species.name.localeCompare(right.species.name);
  });
}
