let modPromise;

function load() {
  return (modPromise ??= import('./pokeapi.mjs'));
}

async function getSpriteUrl(nameOrId) {
  const mod = await load();
  return mod.getSpriteUrl(nameOrId);
}

async function getNationalNumber(nameOrId) {
  const mod = await load();
  return mod.getNationalNumber(nameOrId);
}

module.exports = { getNationalNumber, getSpriteUrl };
