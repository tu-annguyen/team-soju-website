const GEN5_ANIMATED_SHINY_SPRITE_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/shiny';

function normalizePokemonName(value) {
  return String(value || '').trim().toLowerCase();
}

function buildAnimatedShinySpriteUrl(pokemonId, variant = null) {
  if (!pokemonId) return null;

  const normalizedVariant = normalizePokemonName(variant);
  if (!normalizedVariant || !normalizedVariant.includes('-')) {
    return `${GEN5_ANIMATED_SHINY_SPRITE_BASE}/${pokemonId}.gif`;
  }

  if (normalizedVariant.endsWith('-female')) {
    return `${GEN5_ANIMATED_SHINY_SPRITE_BASE}/female/${pokemonId}.gif`;
  }

  if (normalizedVariant.endsWith('-male')) {
    return `${GEN5_ANIMATED_SHINY_SPRITE_BASE}/${pokemonId}.gif`;
  }

  const variantSuffix = normalizedVariant.replace(/^[^-]+-/, '');
  if (!variantSuffix || variantSuffix === normalizedVariant) {
    return `${GEN5_ANIMATED_SHINY_SPRITE_BASE}/${pokemonId}.gif`;
  }

  return `${GEN5_ANIMATED_SHINY_SPRITE_BASE}/${pokemonId}-${variantSuffix}.gif`;
}

module.exports = { buildAnimatedShinySpriteUrl };
