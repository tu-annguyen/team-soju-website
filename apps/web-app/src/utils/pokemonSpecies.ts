import pokemonTiers from '../../../../packages/utils/pokemon-tiers.json';

function titleCaseToken(value: string) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatPokemonSpeciesName(value: string) {
  return titleCaseToken(value)
    .replace(/\bMr Mime\b/g, 'Mr. Mime')
    .replace(/\bMime Jr\b/g, 'Mime Jr.')
    .replace(/\bNidoran F\b/g, 'Nidoran-F')
    .replace(/\bNidoran M\b/g, 'Nidoran-M')
    .replace(/\bPorygon Z\b/g, 'Porygon-Z');
}

const speciesNames = Array.from(
  new Set(
    Object.values(pokemonTiers)
      .flat()
      .map((species) => formatPokemonSpeciesName(species))
  )
).sort((a, b) => a.localeCompare(b));

export const POKEMON_SPECIES_NAMES = speciesNames;

export const POKEMON_SPECIES_NAME_SET = new Set(
  POKEMON_SPECIES_NAMES.map((species) => species.toLowerCase())
);
