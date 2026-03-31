import PokedexModule from 'pokedex-promise-v2';

const Pokedex = PokedexModule.default || PokedexModule;
let pokedex;

function getPokedex() {
  if (!pokedex) {
    pokedex = new Pokedex();
  }
  return pokedex;
}

/** Fetches the national number for a given Pokémon name
 * @param {string} pokemon - Pokémon name
 * @returns {number|null} National number or null if not found
 */
export async function getNationalNumber(pokemon) {
  try {
    const species = await getPokedex().getPokemonSpeciesByName(String(pokemon).trim().toLowerCase());
    return species?.id ?? null;
  } catch (err) {
    console.error(`Error fetching species data for Pokémon "${pokemon}":`, err.message || err);
    return null;
  }
}

/**
 * @param {*} pokemonId national pokedex number of the pokemon
 * @returns a URL to the Gen V animated shiny sprite associated with the pokemonId
 */
export async function getSpriteUrl(pokemonId) {
  try {
    const pokemon = await getPokedex().getPokemonByName(pokemonId);
    return pokemon.sprites.versions["generation-v"]["black-white"].animated.front_shiny;
  } catch (err) {
    console.error(`Error fetching data for Pokémon "${pokemonId}":`, err.message || err);
    return null;
  }
}
