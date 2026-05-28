const Joi = require('joi');
const {
  getPokemonVariants,
} = require('@team-soju/utils');

const NATURE_CHOICES = [
  'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
  'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
  'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
  'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
  'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky',
];

const ENCOUNTER_TYPE_CHOICES = [
  'single',
  'x5_horde',
  'x3_horde',
  'horde',
  'safari',
  'fishing',
  'raid_den',
  'egg',
  'mysterious_ball',
  'honey_tree',
  'rock_smash',
  'swarm',
  'fossil',
  'headbutt',
  'gift',
];

const SHINY_STATUS_CHOICES = ['Owned', 'Sold', 'Fled', 'Died', 'Bred'];
const NIDORAN_ROUTE_NAMES = new Set(['nidoran-f', 'nidoran-m']);

const memberSchema = Joi.object({
  ign: Joi.string().min(1).max(50).required(),
  discord_id: Joi.string().max(20).optional(),
  rank: Joi.string().max(20).default('Trainer'),
  notes: Joi.string().optional(),
});

const updateMemberSchema = Joi.object({
  ign: Joi.string().min(1).max(50).optional(),
  discord_id: Joi.string().max(20).optional(),
  rank: Joi.string().max(20).optional(),
  notes: Joi.string().optional(),
  join_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  is_active: Joi.boolean().optional(),
});

const shinySchema = Joi.object({
  national_number: Joi.number().integer().min(1).max(1010).required(),
  pokemon: Joi.string().max(50).required(),
  variants: Joi.string().trim().lowercase().max(50).optional(),
  original_trainer: Joi.string().required(),
  catch_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  total_encounters: Joi.number().integer().min(0).default(0),
  species_encounters: Joi.number().integer().min(0).default(0),
  encounter_type: Joi.string().valid(...ENCOUNTER_TYPE_CHOICES).required(),
  location: Joi.string().max(100).optional(),
  nature: Joi.string().valid(...NATURE_CHOICES).optional(),
  iv_hp: Joi.number().integer().min(0).max(31).optional(),
  iv_attack: Joi.number().integer().min(0).max(31).optional(),
  iv_defense: Joi.number().integer().min(0).max(31).optional(),
  iv_sp_attack: Joi.number().integer().min(0).max(31).optional(),
  iv_sp_defense: Joi.number().integer().min(0).max(31).optional(),
  iv_speed: Joi.number().integer().min(0).max(31).optional(),
  is_secret: Joi.boolean().default(false),
  is_alpha: Joi.boolean().default(false),
  screenshot_url: Joi.string().uri().optional(),
  status: Joi.string().valid(...SHINY_STATUS_CHOICES).default('Owned'),
  notes: Joi.string().allow(null).optional(),
});

const updateShinySchema = Joi.object({
  national_number: Joi.number().integer().min(1).max(1010).optional(),
  pokemon: Joi.string().max(50).optional(),
  variants: Joi.string().trim().lowercase().max(50).optional(),
  original_trainer: Joi.string().optional(),
  catch_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  total_encounters: Joi.number().integer().min(0).optional(),
  species_encounters: Joi.number().integer().min(0).optional(),
  encounter_type: Joi.string().valid(...ENCOUNTER_TYPE_CHOICES).optional(),
  location: Joi.string().max(100).optional(),
  nature: Joi.string().valid(...NATURE_CHOICES).optional(),
  iv_hp: Joi.number().integer().min(0).max(31).optional(),
  iv_attack: Joi.number().integer().min(0).max(31).optional(),
  iv_defense: Joi.number().integer().min(0).max(31).optional(),
  iv_sp_attack: Joi.number().integer().min(0).max(31).optional(),
  iv_sp_defense: Joi.number().integer().min(0).max(31).optional(),
  iv_speed: Joi.number().integer().min(0).max(31).optional(),
  is_secret: Joi.boolean().optional(),
  is_alpha: Joi.boolean().optional(),
  screenshot_url: Joi.string().uri().optional(),
  status: Joi.string().valid(...SHINY_STATUS_CHOICES).optional(),
  notes: Joi.string().allow(null).optional(),
});

function normalizePokemonRouteName(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePokemonName(value) {
  const normalized = normalizePokemonRouteName(value);
  return NIDORAN_ROUTE_NAMES.has(normalized) ? 'nidoran' : normalized;
}

function normalizeVariantName(value) {
  const normalized = normalizePokemonRouteName(value);
  return NIDORAN_ROUTE_NAMES.has(normalized) ? 'nidoran' : normalized;
}

async function enrichShinyPayloadWithVariants(payload) {
  const hasPokemon = Boolean(payload?.pokemon);
  const rawPokemon = hasPokemon ? normalizePokemonRouteName(payload.pokemon) : undefined;
  const pokemon = hasPokemon ? normalizePokemonName(payload.pokemon) : undefined;
  const hasExplicitVariant = Object.prototype.hasOwnProperty.call(payload || {}, 'variants');
  const normalizedVariant = hasExplicitVariant ? normalizeVariantName(payload.variants) : null;

  const nextPayload = {
    ...payload,
    ...(hasPokemon ? { pokemon } : {}),
    ...(hasExplicitVariant ? { variants: normalizedVariant } : {}),
  };

  if (!hasPokemon) {
    return nextPayload;
  }

  const variantData = await getPokemonVariants(rawPokemon || pokemon);

  return {
    ...nextPayload,
    variants: normalizedVariant || pokemon,
    national_number: nextPayload.national_number ?? variantData?.national_number ?? null,
  };
}

function parseBooleanParam(value) {
  if (value === null || value === undefined) return undefined;
  return String(value) === 'true';
}

function buildShinyFilters(url) {
  const filters = { active: true };
  const searchParams = url.searchParams;

  if (searchParams.has('active')) filters.active = parseBooleanParam(searchParams.get('active'));
  if (searchParams.get('trainer_id')) filters.trainer_id = searchParams.get('trainer_id');
  if (searchParams.get('pokemon_name')) filters.pokemon_name = searchParams.get('pokemon_name');
  if (searchParams.get('encounter_type')) filters.encounter_type = searchParams.get('encounter_type');
  if (searchParams.has('is_secret')) filters.is_secret = parseBooleanParam(searchParams.get('is_secret'));
  if (searchParams.has('is_alpha')) filters.is_alpha = parseBooleanParam(searchParams.get('is_alpha'));
  if (searchParams.get('catch_date_before')) filters.catch_date_before = searchParams.get('catch_date_before');
  if (searchParams.get('catch_date_after')) filters.catch_date_after = searchParams.get('catch_date_after');
  if (searchParams.get('sort_by')) filters.sort_by = searchParams.get('sort_by');
  if (searchParams.get('sort_order')) filters.sort_order = searchParams.get('sort_order');
  if (searchParams.get('secondary_sort_by')) filters.secondary_sort_by = searchParams.get('secondary_sort_by');
  if (searchParams.get('secondary_sort_order')) filters.secondary_sort_order = searchParams.get('secondary_sort_order');
  if (searchParams.get('limit')) filters.limit = parseInt(searchParams.get('limit'), 10);

  return filters;
}

module.exports = {
  buildShinyFilters,
  enrichShinyPayloadWithVariants,
  memberSchema,
  normalizePokemonName,
  normalizeVariantName,
  shinySchema,
  updateMemberSchema,
  updateShinySchema,
};
