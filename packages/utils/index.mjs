// ESM entrypoint for @team-soju/utils
// Only export functionality safe for browser/SSR (no sharp, axios, etc.)

import tiers from './pokemon-tiers.json' with { type: 'json' };

const TIER_POINTS = {
  'Tier 0': 30,
  'Tier 1': 25,
  'Tier 2': 15,
  'Tier 3': 10,
  'Tier 4': 6,
  'Tier 5': 3,
  'Tier 6': 2,
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

export function calculateShinyPoints(pokemonName, options = {}) {
  const encounterType = options.encounter_type || options.encounterType || null;
  const isAlpha = Boolean(options.is_alpha ?? options.isAlpha);
  const isSecret = Boolean(options.is_secret ?? options.isSecret);
  const tier = getPokemonTier(pokemonName);
  const tierPoints = TIER_POINTS[tier] || 0;

  let basePoints = tierPoints;

  if (encounterType === 'egg') {
    basePoints = Math.max(basePoints, 20);
  }

  if (isAlpha) {
    basePoints = Math.max(basePoints, 50);
  }

  if (tier === 'Legendary/Mythical') {
    basePoints = Math.max(basePoints, 100);
  }

  let bonusPoints = 0;

  if (isSecret) {
    bonusPoints += 10;
  }

  if (encounterType === 'safari') {
    bonusPoints += 5;
  }

  return basePoints + bonusPoints;
}

export function formatLocalDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
