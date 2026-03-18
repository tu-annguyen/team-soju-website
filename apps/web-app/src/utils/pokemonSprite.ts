const POKEMON_DB_SPRITE_BASE_URL =
  'https://img.pokemondb.net/sprites/black-white/anim/shiny';

const toPokemonDbSlug = (pokemonName: string) =>
  pokemonName.trim().toLowerCase().replace(/\s+/g, '-');

export const getShinySpriteUrl = (pokemonName: string) => {
  const slug = toPokemonDbSlug(pokemonName);

  if (!slug) {
    return '';
  }

  return `${POKEMON_DB_SPRITE_BASE_URL}/${slug}.gif`;
};
