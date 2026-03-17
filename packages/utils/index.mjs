// ESM entrypoint for @team-soju/utils
// Only export functionality safe for browser/SSR (no sharp, axios, etc.)

import tiers from './pokemon-tiers.json' with { type: 'json' };

export { getSpriteUrl, getNationalNumber, getPokemonNationalNumber } from './pokeapi.mjs';

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

function normalizePokemonName(pokemon) {
  return String(pokemon || '').trim().toLowerCase();
}

export function capitalize(value) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase() : normalized;
}

export function getPokemonTier(pokemon) {
  const normalized = normalizePokemonName(pokemon);
  if (pokemon === 'jellicent-male' || pokemon === 'basculin-red-striped' || pokemon === 'wormadam-trash') {
    console.log('Determining tier for:', normalized);
  }

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

  if (tier == "Legendary/Mythical") {
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
