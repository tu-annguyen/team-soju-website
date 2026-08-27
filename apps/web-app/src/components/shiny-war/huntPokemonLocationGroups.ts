import { groupHuntSpotsByPokemon } from './huntGroups';
import { groupHuntSpotsByLocation } from './huntLocationGroups';
import type { HuntSpecies, HuntSpot } from './types';

export type HuntPokemonLocationGroup = {
  key: string;
  spots: HuntSpot[];
};

export type HuntPokemonLocationSection = {
  species: HuntSpecies;
  locations: HuntPokemonLocationGroup[];
  spots: HuntSpot[];
};

function pokemonLocationKey(species: HuntSpecies, locationKey: string) {
  return `${species.slug}|${species.form || ''}|${locationKey}`;
}

export function groupHuntSpotsByPokemonLocation(
  spots: HuntSpot[],
  speciesFilter = '',
  minimumTier = ''
): HuntPokemonLocationSection[] {
  return groupHuntSpotsByPokemon(spots, speciesFilter, minimumTier).map(({ species, spots: speciesSpots }) => ({
    species,
    spots: speciesSpots,
    locations: groupHuntSpotsByLocation(speciesSpots).map((location) => ({
      ...location,
      key: pokemonLocationKey(species, location.key),
    })),
  }));
}
