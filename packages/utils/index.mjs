// ESM entrypoint for @team-soju/utils
// Only export functionality safe for browser/SSR (no sharp, axios, etc.)

import tiers from './pokemon-tiers.json' with { type: 'json' };

export { getSpriteUrl, getNationalNumber } from './pokeapi.mjs';

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

export function capitalize(value) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase() : normalized;
}

export function getPokemonTier(pokemon) {
  const normalized = normalizePokemonName(pokemon);

  for (const [tier, pokemonList] of Object.entries(tiers)) {
    if (pokemonList.includes(normalized)) {
      return tier;
    }
  }

  return 'Unknown';
}

export async function calculateShinyPoints(shinyId, apiBaseUrl) {
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
