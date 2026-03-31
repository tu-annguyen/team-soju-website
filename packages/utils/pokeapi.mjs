import PokedexModule from 'pokedex-promise-v2';

const Pokedex = PokedexModule.default || PokedexModule;
let pokedex;

function getPokedex() {
  if (!pokedex) {
    pokedex = new Pokedex();
  }
  return pokedex;
}

function normalizePokemonName(value) {
  return String(value || '').trim().toLowerCase();
}

function createVariantEntry({ value, label, source, isDefault = false }) {
  const normalizedValue = normalizePokemonName(value);
  if (!normalizedValue) return null;

  return {
    value: normalizedValue,
    label: String(label || normalizedValue).trim(),
    source,
    is_default: Boolean(isDefault),
  };
}

function dedupeVariantEntries(entries) {
  const seen = new Set();
  const deduped = [];

  for (const entry of entries) {
    if (!entry?.value || seen.has(entry.value)) continue;
    seen.add(entry.value);
    deduped.push(entry);
  }

  return deduped;
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

/**
 * Resolves a species' possible variants by combining species-level varieties
 * with cosmetic form data when the species endpoint alone is not enough.
 *
 * @param {string|number} pokemon - Pokémon name or id
 * @returns {Promise<{
 *   species: string|null,
 *   national_number: number|null,
 *   variants: string[],
 *   entries: Array<{ value: string, label: string, source: string, is_default: boolean }>,
 *   metadata: { has_gender_differences: boolean, forms_switchable: boolean }
 * }>}
 */
export async function getPokemonVariants(pokemon) {
  try {
    const pokemonData = await getPokedex().getPokemonByName(normalizePokemonName(pokemon));
    const speciesName = normalizePokemonName(pokemonData?.species?.name || pokemonData?.name);
    const species = await getPokedex().getPokemonSpeciesByName(speciesName);

    const varietyEntries = (species?.varieties || [])
      .map(variety => createVariantEntry({
        value: variety?.pokemon?.name,
        label: variety?.pokemon?.name,
        source: 'species.varieties',
        isDefault: variety?.is_default,
      }))
      .filter(Boolean);

    const formEntries = await Promise.all(
      (pokemonData?.forms || []).map(async (form) => {
        try {
          const formData = await getPokedex().getPokemonFormByName(form.name);
          return createVariantEntry({
            value: formData?.name || formData?.pokemon?.name || form?.name,
            label: formData?.form_name || formData?.name || form?.name,
            source: 'pokemon.forms',
            isDefault: formData?.is_default,
          });
        } catch (error) {
          return createVariantEntry({
            value: form?.name,
            label: form?.name,
            source: 'pokemon.forms',
            isDefault: form?.name === pokemonData?.name,
          });
        }
      })
    );

    const entries = dedupeVariantEntries([...varietyEntries, ...formEntries.filter(Boolean)]);

    return {
      species: species?.name || speciesName || null,
      national_number: species?.id ?? null,
      variants: entries.map(entry => entry.value),
      entries,
      metadata: {
        has_gender_differences: Boolean(species?.has_gender_differences),
        forms_switchable: Boolean(species?.forms_switchable),
      },
    };
  } catch (err) {
    console.error(`Error fetching variant data for Pokémon "${pokemon}":`, err.message || err);
    return {
      species: null,
      national_number: null,
      variants: [],
      entries: [],
      metadata: {
        has_gender_differences: false,
        forms_switchable: false,
      },
    };
  }
}
