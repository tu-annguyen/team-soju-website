import { capitalize } from '@team-soju/utils';

export { capitalize };

const normalizePokemonLabel = (value: string) =>
  String(value || '')
    .trim()
    .replace(/[-_]+/g, ' ');

const toTitleCase = (value: string) =>
  String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => capitalize(part))
    .join(' ');

const normalizePokemonSlug = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase();

const normalizePokemonDisplayName = (value: string) => {
  const normalized = normalizePokemonSlug(value);
  return normalized === 'nidoran-f' || normalized === 'nidoran-m'
    ? 'nidoran'
    : normalized;
};

export const formatPokemonCardName = (pokemonName: string) => {
  return toTitleCase(normalizePokemonLabel(normalizePokemonDisplayName(pokemonName)));
};

export const formatVariantLabel = (variantName?: string | null, pokemonName?: string) => {
  const normalizedVariant = normalizePokemonDisplayName(String(variantName || ''));
  const normalizedPokemon = normalizePokemonDisplayName(String(pokemonName || ''));

  if (!normalizedVariant || normalizedVariant === normalizedPokemon) {
    return null;
  }

  const variantSuffix = normalizedPokemon && normalizedVariant.startsWith(`${normalizedPokemon}-`)
    ? normalizedVariant.slice(normalizedPokemon.length + 1)
    : normalizedVariant;

  return toTitleCase(normalizePokemonLabel(variantSuffix));
};

export const formatPokemonDetailsName = (pokemonName: string, variantName?: string | null) => {
  const formattedBaseName = formatPokemonCardName(pokemonName);
  const formattedVariant = formatVariantLabel(variantName, pokemonName);

  if (!formattedVariant) {
    return formattedBaseName;
  }

  return `${formattedBaseName} (${formattedVariant})`;
};
