/** Fetches the national number for a given Pokémon name
 * @param {string} pokemon - Pokémon name
 * @returns {number|null} National number or null if not found
 */
export async function getNationalNumber(pokemon) {
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemon}`);

    if (!response.ok) {
      console.error(`Failed to fetch data for Pokémon "${pokemon}": ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.id;
  } catch (err) {
    console.error(`Error fetching data for Pokémon "${pokemon}":`, err.message || err);
  }
}

/**
 * @param {*} pokemonId national pokedex number of the pokemon
 * @returns a URL to the Gen V animated shiny sprite associated with the pokemonId
 */
export async function getSpriteUrl(pokemonId) {
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
    const data = await response.json();
    return data.sprites.versions["generation-v"]["black-white"].animated.front_shiny;
  } catch (err) {
    console.error(`Error fetching data for Pokémon "${pokemonId}":`, err.message || err);
    return null;
  }
}