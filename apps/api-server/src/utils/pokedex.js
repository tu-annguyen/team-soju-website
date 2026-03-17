const PokedexModule = require('pokedex-promise-v2');
const Pokedex = PokedexModule.default || PokedexModule;

const pokedex = new Pokedex();

async function getPokemonNationalNumber(nameOrId) {
  const species = await pokedex.getPokemonSpeciesByName(String(nameOrId).trim().toLowerCase());
  return species?.id ?? null;
}

module.exports = {
  getPokemonNationalNumber,
};
