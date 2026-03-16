// Image processing utilities for Team Soju projects
// use axios + sharp to support more formats (GIFs etc.)
const { GifUtil, GifCodec } = require('gifwrap');

/**
 * Fetches a GIF from a URL and converts it to grayscale.
 * @param {string} url - The source GIF URL.
 * @returns {Promise<Buffer>} - The processed GIF as a Buffer.
 */
async function greyscale(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Read the GIF
    const gif = await GifUtil.read(inputBuffer);
    
    // Manually apply grayscale to each frame
    gif.frames.forEach(frame => {
        const { data } = frame.bitmap; // This is the RGBA Buffer
        for (let i = 0; i < data.length; i += 4) {
            // Luma formula for accurate grayscale
            const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            
            data[i]     = gray; // Red
            data[i + 1] = gray; // Green
            data[i + 2] = gray; // Blue
            // data[i + 3] is Alpha (transparency), we leave it as is
        }
    });

    // Encode frames back into a Buffer
    const codec = new GifCodec();
    const encodedGif = await codec.encodeGif(gif.frames, { loops: gif.loops });
    
    return encodedGif.buffer;
}

const tiers = require('./pokemon-tiers.json')

const TIER_POINTS = {
    'Tier 0': 30,
    'Tier 1': 25,
    'Tier 2': 15,
    'Tier 3': 10,
    'Tier 4': 6,
    'Tier 5': 3,
    'Tier 6': 2,
    'Tier 7': 1,
};

const LEGENDARY_OR_MYTHICAL = new Set([
    'articuno', 'zapdos', 'moltres', 'mewtwo', 'mew',
    'raikou', 'entei', 'suicune', 'lugia', 'ho-oh', 'celebi',
    'regirock', 'regice', 'registeel', 'latias', 'latios', 'kyogre', 'groudon',
    'rayquaza', 'jirachi', 'deoxys', 'uxie', 'mesprit', 'azelf', 'dialga', 'palkia',
    'heatran', 'regigigas', 'giratina', 'cresselia', 'phione', 'manaphy', 'darkrai',
    'shaymin', 'arceus', 'victini', 'cobalion', 'terrakion', 'virizion', 'tornadus',
    'thundurus', 'reshiram', 'zekrom', 'landorus', 'kyurem', 'keldeo', 'meloetta',
    'genesect'
]);

function normalizePokemonName(pokemon) {
    return String(pokemon || '').trim().toLowerCase();
}

function capitalize(value) {
    const normalized = String(value || '').trim();
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase() : normalized;
}

/**
 * Gets the tier of a Pokémon based on its name.
 * @param {string} pokemon - The name of the Pokémon.
 * @returns {string} - The tier of the Pokémon.
 */
function getPokemonTier(pokemon) {
    const normalized = normalizePokemonName(pokemon);

    for (const [tier, pokemonList] of Object.entries(tiers)) {
        if (pokemonList.includes(normalized)) {
            return tier;
        }
    }
    return 'Unknown';
}

/**
 * Calculates the points for a shiny Pokémon based on its ID and API base URL.
 * @param {string} shinyId - The ID of the shiny Pokémon.
 * @param {string} apiBaseUrl - The base URL of the API.
 * @returns {Promise<number>} - The calculated points.
 */
async function calculateShinyPoints(shinyId, apiBaseUrl) {
    const response = await fetch(`${apiBaseUrl}/shinies/${shinyId}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch shiny ${shinyId}: ${response.statusText}`);
    }

    const payload = await response.json();
    const shiny = payload.data;
    const pokemonName = normalizePokemonName(shiny.pokemon_name || shiny.pokemon);
    const tier = getPokemonTier(pokemonName);
    const tierPoints = TIER_POINTS[tier] || 0;

    let basePoints = tierPoints;

    if (shiny.encounter_type === 'egg') {
        basePoints = Math.max(basePoints, 20);
    }

    if (shiny.is_alpha) {
        basePoints = Math.max(basePoints, 50);
    }

    if (LEGENDARY_OR_MYTHICAL.has(pokemonName)) {
        basePoints = Math.max(basePoints, 100);
    }

    let bonusPoints = 0;

    if (shiny.is_secret) {
        bonusPoints += 10;
    }

    if (shiny.encounter_type === 'safari') {
        bonusPoints += 5;
    }

    return basePoints + bonusPoints;
}

// PokeAPI utilities for fetching Pokémon data (CJS version)
const pokeapi = require('./pokeapi.cjs');

module.exports = {
  greyscale,
  capitalize,
  getPokemonTier,
  calculateShinyPoints,
  ...pokeapi
};
