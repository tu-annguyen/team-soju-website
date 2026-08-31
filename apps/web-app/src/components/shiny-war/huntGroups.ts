import type { HuntSpot, PokemonHuntGroup } from './types';
import type { HuntSort, SortDirection } from '../hunt-finder/types';

export function groupHuntSpotsByPokemon(
  spots: HuntSpot[],
  speciesFilter = '',
  minimumTier = '',
  sort: HuntSort = 'pointsPerHour',
  sortDirection: SortDirection = 'desc'
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
    const direction = sortDirection === 'asc' ? 1 : -1;
    if (sort === 'alphabetical') {
      return direction * left.species.name.localeCompare(right.species.name);
    }
    const metric = sort === 'expPerHour' ? 'expPerHour' : 'pointsPerHour';
    const leftRates = left.spots.flatMap((spot) => spot[metric] == null ? [] : [Number(spot[metric])]);
    const rightRates = right.spots.flatMap((spot) => spot[metric] == null ? [] : [Number(spot[metric])]);
    if (leftRates.length || rightRates.length) {
      if (!leftRates.length) return 1;
      if (!rightRates.length) return -1;
      const leftRate = sortDirection === 'asc' ? Math.min(...leftRates) : Math.max(...leftRates);
      const rightRate = sortDirection === 'asc' ? Math.min(...rightRates) : Math.max(...rightRates);
      const rateDifference = direction * (leftRate - rightRate);
      if (rateDifference) return rateDifference;
    }
    return right.species.points - left.species.points
      || left.species.name.localeCompare(right.species.name);
  });
}
