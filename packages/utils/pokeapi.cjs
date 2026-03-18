let modPromise;

function load() {
  return (modPromise ??= import('./pokeapi.mjs'));
}

async function getNationalNumber(nameOrId) {
  const mod = await load();
  return mod.getNationalNumber(nameOrId);
}

async function getSpriteUrl(nameOrId) {
  const mod = await load();
  return mod.getSpriteUrl(nameOrId);
}

async function getPokemonNationalNumber(nameOrId) {
  const mod = await load();
  return mod.getPokemonNationalNumber(nameOrId);
}

module.exports = { getNationalNumber, getPokemonNationalNumber, getSpriteUrl };
