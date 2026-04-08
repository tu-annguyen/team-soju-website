import PokedexModule from 'pokedex-promise-v2';
import { buildAnimatedShinySpriteUrl } from './sprite-url.mjs';

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

const NIDORAN_ROUTE_NAMES = new Set(['nidoran-f', 'nidoran-m']);

function isNidoranRouteName(value) {
  return NIDORAN_ROUTE_NAMES.has(normalizePokemonName(value));
}

function buildSingleEntryVariantResult(species, nationalNumber, metadata = {}) {
  const normalizedSpecies = normalizePokemonName(species);
  const entry = createVariantEntry({
    value: normalizedSpecies,
    label: normalizedSpecies,
    source: 'species.special-case',
    isDefault: true,
  });

  return {
    species: normalizedSpecies || null,
    national_number: nationalNumber ?? null,
    variants: entry ? [entry.value] : [],
    entries: entry ? [entry] : [],
    metadata: {
      has_gender_differences: Boolean(metadata.has_gender_differences),
      forms_switchable: Boolean(metadata.forms_switchable),
    },
  };
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

function hasGenerationVAnimatedSprite(pokemonData) {
  const animatedSprites = pokemonData?.sprites?.versions?.['generation-v']?.['black-white']?.animated;
  if (!animatedSprites) return false;

  return Object.values(animatedSprites).some(Boolean);
}

async function filterEntriesToGenerationV(entries) {
  const spriteAvailabilityCache = new Map();

  const filteredEntries = await Promise.all(entries.map(async (entry) => {
    if (!entry?.value) return null;

    if (!spriteAvailabilityCache.has(entry.value)) {
      const hasGen5Sprite = await getPokedex()
        .getPokemonByName(entry.value)
        .then(hasGenerationVAnimatedSprite)
        .catch(() => false);

      spriteAvailabilityCache.set(entry.value, hasGen5Sprite);
    }

    return spriteAvailabilityCache.get(entry.value) ? entry : null;
  }));

  return filteredEntries.filter(Boolean);
}

function collapseBaseSpeciesEntry(entries, speciesName) {
  const normalizedSpecies = normalizePokemonName(speciesName);
  if (!normalizedSpecies) return entries;

  const hasFormSpecificEntries = entries.some(entry =>
    entry?.value &&
    entry.value !== normalizedSpecies &&
    entry.value.startsWith(`${normalizedSpecies}-`)
  );

  if (!hasFormSpecificEntries) {
    return entries;
  }

  return entries.filter(entry => entry?.value !== normalizedSpecies);
}

async function resolveSpeciesContext(pokemon) {
  const normalizedPokemon = normalizePokemonName(pokemon);
  const pokedex = getPokedex();

  try {
    const species = await pokedex.getPokemonSpeciesByName(normalizedPokemon);
    return { species, speciesName: normalizePokemonName(species?.name || normalizedPokemon) };
  } catch (speciesError) {
    const pokemonData = await pokedex.getPokemonByName(normalizedPokemon);
    const speciesName = normalizePokemonName(pokemonData?.species?.name || pokemonData?.name || normalizedPokemon);
    const species = await pokedex.getPokemonSpeciesByName(speciesName);
    return { species, speciesName };
  }
}

async function getFormEntriesForPokemon(pokemonName) {
  const normalizedPokemon = normalizePokemonName(pokemonName);
  if (!normalizedPokemon) return [];

  try {
    const pokemonData = await getPokedex().getPokemonByName(normalizedPokemon);
    return await Promise.all(
      (pokemonData?.forms || []).map(async (form) => {
        try {
          const formData = await getPokedex().getPokemonFormByName(form.name);
          return createVariantEntry({
            value: formData?.name || formData?.pokemon?.name || form?.name || pokemonData?.name,
            label: formData?.form_name || formData?.pokemon?.name || form?.name || pokemonData?.name,
            source: 'pokemon.forms',
            isDefault: formData?.is_default,
          });
        } catch (error) {
          return createVariantEntry({
            value: form?.name || pokemonData?.name,
            label: form?.name || pokemonData?.name,
            source: 'pokemon.forms',
            isDefault: form?.name === pokemonData?.name,
          });
        }
      })
    );
  } catch (error) {
    return [];
  }
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
export async function getSpriteUrl(pokemonId, options = {}) {
  const variant = normalizePokemonName(
    typeof options === 'string'
      ? options
      : options?.variant
  );

  if (variant) {
    return buildAnimatedShinySpriteUrl(pokemonId, variant);
  }

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
    const normalizedPokemon = normalizePokemonName(pokemon);
    if (normalizedPokemon === 'nidoran') {
      return buildSingleEntryVariantResult('nidoran', null);
    }

    const { species, speciesName } = await resolveSpeciesContext(pokemon);
    if (isNidoranRouteName(normalizedPokemon) || isNidoranRouteName(species?.name) || isNidoranRouteName(speciesName)) {
      return buildSingleEntryVariantResult('nidoran', species?.id ?? null, {
        has_gender_differences: species?.has_gender_differences,
        forms_switchable: species?.forms_switchable,
      });
    }

    const varietyEntries = (species?.varieties || [])
      .map(variety => createVariantEntry({
        value: variety?.pokemon?.name,
        label: variety?.pokemon?.name,
        source: 'species.varieties',
        isDefault: variety?.is_default,
      }))
      .filter(Boolean);

    const formEntriesByVariety = await Promise.all(
      varietyEntries.map(entry => getFormEntriesForPokemon(entry.value))
    );

    const fallbackEntries = varietyEntries.length > 0
      ? []
      : [createVariantEntry({
        value: speciesName,
        label: speciesName,
        source: 'species.fallback',
        isDefault: true,
      })];

    const generationVEntries = await filterEntriesToGenerationV(
      dedupeVariantEntries([
        ...varietyEntries,
        ...formEntriesByVariety.flat().filter(Boolean),
        ...fallbackEntries.filter(Boolean),
      ])
    );

    const entries = collapseBaseSpeciesEntry(
      generationVEntries,
      species?.name || speciesName
    );

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
