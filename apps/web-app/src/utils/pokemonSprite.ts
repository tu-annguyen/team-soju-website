const POKEMON_DB_SPRITE_BASE_URL =
  'https://img.pokemondb.net/sprites/black-white/anim/shiny';

const POKEMON_DB_SLUG_OVERRIDES: Record<string, string> = {
  // In Team Soju data, the plain names represent the female forms while
  // PokemonDB uses the unsuffixed slug for the male sprites.
  frillish: 'frillish-f',
  'frillish-male': 'frillish',
  jellicent: 'jellicent-f',
  'jellicent-male': 'jellicent',
};

const toPokemonDbSlug = (pokemonName: string) => {
  const normalized = pokemonName.trim().toLowerCase().replace(/\s+/g, '-');

  return POKEMON_DB_SLUG_OVERRIDES[normalized] ?? normalized;
};

export const getShinySpriteUrl = (pokemonName: string) => {
  const slug = toPokemonDbSlug(pokemonName);

  if (!slug) {
    return '';
  }

  return `${POKEMON_DB_SPRITE_BASE_URL}/${slug}.gif`;
};
