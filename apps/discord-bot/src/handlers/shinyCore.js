/**
 * Shiny command handlers
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require('../discord/api');
const fetchClient = require('../fetchClient');
const { ENCOUNTER_TYPE_CHOICES, NATURE_CHOICES, SHINY_STATUS_CHOICES } = require('../commands');
const { generateEncountersString, validateSojuTrainerIGN } = require('../utils');
const { buildShinyTierField, enrichRawShinyEmbed } = require('./shinyEmbedDetails');
const { handleAddShinyScreenshot } = require('./shinyScreenshotHandler');
const {
  capitalize,
  getKnownPokemonNames,
  getPokemonEvolutionLine,
  getNationalNumber,
  getSpriteUrl,
  getPokemonVariants,
  getDateInTimezone,
  getTimeInTimezone,
  getTimezoneOptions,
  normalizeTimezoneInput,
  zonedLocalDateTimeToUtc,
} = require('@team-soju/utils');

function getApiBaseUrl() {
  return (process.env.API_BASE_URL || 'http://localhost:8787/api').replace(/\/+$/, '');
}

function getPublicApiBaseUrl() {
  return (process.env.PUBLIC_API_BASE_URL || getApiBaseUrl()).replace(/\/+$/, '');
}


const SHINY_MANAGER_ROLES = ['Soju', 'Elite 4', 'Champion'];
const SHINY_STAFF_ROLES = ['Elite 4', 'Champion'];
const PAGE_SIZE_FALLBACK = 10;
const MAX_SHINY_SELECT_OPTIONS = 25;
const MAX_VARIANT_SELECT_OPTIONS = 25;
const COMPONENT_PREFIX = 'sh';
const MODAL_PREFIX = 'shm';
const SPECIAL_CHOICES = [
  { name: 'Standard', value: 'standard' },
  { name: 'Secret Shiny', value: 'secret' },
  { name: 'Shiny Alpha', value: 'alpha' },
  { name: 'Secret Alpha', value: 'secret_alpha' },
];
const STATUS_CHOICES = SHINY_STATUS_CHOICES;
const NIDORAN_ROUTE_NAMES = new Set(['nidoran-f', 'nidoran-m']);
const MAX_AUTOCOMPLETE_CHOICES = 25;
const KNOWN_POKEMON_NAMES = getKnownPokemonNames();
const FIELD_CODES = {
  pokemon: 'p',
  encounter_type: 'e',
  status: 's',
  nature: 'n',
  special: 'x',
  catch_date: 'd',
  catch_time: 't',
  timezone: 'z',
  encounters: 'c',
  ivs: 'i',
};
const FIELDS_BY_CODE = Object.fromEntries(
  Object.entries(FIELD_CODES).map(([field, code]) => [code, field])
);

function getAuthHeaders() {
  return { headers: { Authorization: `Bearer ${process.env.BOT_API_TOKEN}` } };
}

async function updateShinyRecord(shinyId, updates) {
  const response = await fetchClient.put(`${getApiBaseUrl()}/shinies/${shinyId}`, updates, getAuthHeaders());
  return response.data.data;
}

function combineLocalDateTime(date, time, timezone) {
  if (!time) return null;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Local capture time must use HH:MM in 24-hour format.');
  }
  return zonedLocalDateTimeToUtc(`${date}T${time}:00`, timezone);
}

function getTimezoneOption(interaction) {
  const value = interaction.options.getString('timezone');
  return normalizeTimezoneInput(value) || value;
}

function getShinyCatchTimezone(shiny) {
  return normalizeTimezoneInput(shiny?.catch_timezone) || 'UTC';
}

function getShinyCatchTime(shiny) {
  if (!shiny?.caught_at_utc) return null;
  return getTimeInTimezone(shiny.caught_at_utc, getShinyCatchTimezone(shiny));
}

function getCatchTimeFields(shiny) {
  const catchTime = getShinyCatchTime(shiny);
  if (!catchTime) return [];
  return [
    { name: 'Catch Time', value: catchTime, inline: true },
    { name: 'Timezone', value: getShinyCatchTimezone(shiny), inline: true },
  ];
}

function getFieldByName(fields, name) {
  return (fields || []).find(field => field?.name === name) || null;
}

function formatPokemonAutocompleteLabel(name) {
  const normalizedName = String(name || '').trim().toLowerCase();
  if (normalizedName === 'nidoran-f') return 'Nidoran ♀';
  if (normalizedName === 'nidoran-m') return 'Nidoran ♂';

  return String(name || '')
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getPokemonDisplayName(shiny) {
  const routeName = String(shiny?.pokemon || shiny?.pokemon_name || '').trim().toLowerCase();
  const nationalNumber = Number(shiny?.national_number);

  if (routeName === 'nidoran-f' || (routeName === 'nidoran' && nationalNumber === 29)) {
    return 'Nidoran ♀';
  }
  if (routeName === 'nidoran-m' || (routeName === 'nidoran' && nationalNumber === 32)) {
    return 'Nidoran ♂';
  }

  return capitalize(shiny?.pokemon_name || shiny?.pokemon);
}

function getPokemonAutocompleteChoices(query) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const matches = KNOWN_POKEMON_NAMES.filter(name => {
    if (!normalizedQuery) return true;
    return name.includes(normalizedQuery);
  }).slice(0, MAX_AUTOCOMPLETE_CHOICES);

  return matches.map(name => ({
    name: formatPokemonAutocompleteLabel(name).slice(0, 100),
    value: name,
  }));
}

async function handlePokemonAutocomplete(interaction) {
  const focusedOption = interaction.options.getFocusedOption();

  if (focusedOption?.name !== 'pokemon') {
    await interaction.respondAutocomplete([]);
    return;
  }

  await interaction.respondAutocomplete(getPokemonAutocompleteChoices(interaction.options.getFocused(true)));
}

function getTimezoneAutocompleteChoices(query) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  return getTimezoneOptions()
    .filter(({ value, label }) => (
      !normalizedQuery
      || value.toLowerCase().includes(normalizedQuery)
      || label.toLowerCase().includes(normalizedQuery)
    ))
    .slice(0, MAX_AUTOCOMPLETE_CHOICES)
    .map(({ value, label }) => ({ name: label.slice(0, 100), value }));
}

async function handleShinyAutocomplete(interaction) {
  const focusedOption = interaction.options.getFocusedOption();
  if (focusedOption?.name === 'pokemon') {
    await handlePokemonAutocomplete(interaction);
    return;
  }
  if (focusedOption?.name === 'timezone') {
    await interaction.respondAutocomplete(
      getTimezoneAutocompleteChoices(interaction.options.getFocused(true))
    );
    return;
  }
  await interaction.respondAutocomplete([]);
}

function normalizeVariantSlug(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return NIDORAN_ROUTE_NAMES.has(normalized) ? 'nidoran' : normalized;
}

function humanizeVariantLabel(value) {
  const normalized = normalizeVariantSlug(value);
  if (!normalized || normalized === 'nidoran') {
    return '';
  }

  return String(value || '')
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isFailedShiny(shiny) {
  return String(shiny?.status || 'Owned').trim() !== 'Owned';
}

function isPublicHttpUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isPrivateIpv4 = /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(hostname);
    return ['http:', 'https:'].includes(url.protocol)
      && !['localhost', '127.0.0.1', '::1'].includes(hostname)
      && !isPrivateIpv4;
  } catch {
    return false;
  }
}

function getGreyscaleSpriteUrl(nationalNumber, variant = null) {
  if (!nationalNumber || !isPublicHttpUrl(getPublicApiBaseUrl())) return null;
  const params = new URLSearchParams();
  if (variant) {
    params.set('variant', normalizeVariantSlug(variant));
  }
  const query = params.toString();
  return `${getPublicApiBaseUrl()}/shinies/sprites/${nationalNumber}/greyscale.gif${query ? `?${query}` : ''}`;
}

function normalizeEncounterType(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, '_');

  if (normalized === '5x_horde') return 'x5_horde';
  if (normalized === '3x_horde') return 'x3_horde';

  return normalized;
}

function formatEncounterType(value) {
  return ({
    x5_horde: '5x Horde',
    x3_horde: '3x Horde',
    horde: 'Horde',
    raid_den: 'Raid Den',
    mysterious_ball: 'Mysterious Ball',
    honey_tree: 'Honey Tree',
    rock_smash: 'Rock Smash',
  }[value] || capitalize(String(value || '').replace(/_/g, ' ')));
}

function getVariantValue(shiny) {
  if (shiny.is_secret && shiny.is_alpha) return 'secret_alpha';
  if (shiny.is_secret) return 'secret';
  if (shiny.is_alpha) return 'alpha';
  return 'standard';
}

function getStatusValue(shiny) {
  return shiny?.status || 'Owned';
}

function normalizePageSize(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 1) {
    return PAGE_SIZE_FALLBACK;
  }

  return Math.min(Math.floor(numericValue), MAX_SHINY_SELECT_OPTIONS);
}

function encodeScope(scope) {
  if (scope === 'mine') return 'm';
  if (scope === 'trainer') return 't';
  return 'a';
}

function decodeScope(scopeCode) {
  if (scopeCode === 'm') return 'mine';
  if (scopeCode === 't') return 'trainer';
  return 'all';
}

function buildCustomId(kind, action, state = {}) {
  const scope = encodeScope(state.scope);
  const trainerId = state.trainerId || '_';
  const page = state.page || 1;
  const pageSize = normalizePageSize(state.pageSize);
  const shinyId = state.shinyId || '_';
  return [COMPONENT_PREFIX, kind, action, scope, trainerId, page, pageSize, shinyId].join(':');
}

function parseCustomId(customId) {
  const [prefix, kind, action, scopeCode, trainerId, page, pageSize, shinyId] = String(customId || '').split(':');
  if (prefix !== COMPONENT_PREFIX) throw new Error('Unknown shiny interaction.');
  return {
    kind,
    action,
    scope: decodeScope(scopeCode),
    trainerId: trainerId === '_' ? null : trainerId,
    page: Number(page) || 1,
    pageSize: normalizePageSize(pageSize),
    shinyId: shinyId === '_' ? null : shinyId,
  };
}

function getMemberRoles(interaction) {
  return interaction.member?.roles?.cache || [];
}

function hasAnyRole(interaction, roleNames) {
  const memberRoles = getMemberRoles(interaction);
  return roleNames.some(roleName => memberRoles.some(role => role.name === roleName));
}

async function assertCanManageShiny(interaction, shiny, actionLabel = 'manage') {
  if (!hasAnyRole(interaction, SHINY_MANAGER_ROLES)) {
    throw new Error(`You need one of these roles to ${actionLabel} shinies: ${SHINY_MANAGER_ROLES.join(', ')}`);
  }

  if (hasAnyRole(interaction, SHINY_STAFF_ROLES)) {
    return;
  }

  const ignValidation = await validateSojuTrainerIGN(interaction, shiny.trainer_name);
  if (!ignValidation.valid) {
    throw new Error(ignValidation.reason);
  }
}

function buildIvString(shiny) {
  const ivs = [
    shiny.iv_hp,
    shiny.iv_attack,
    shiny.iv_defense,
    shiny.iv_sp_attack,
    shiny.iv_sp_defense,
    shiny.iv_speed,
  ];

  return ivs.every(iv => Number.isInteger(iv)) ? ivs.join(',') : '';
}

function formatShinySummary(shiny) {
  const pieces = [shiny.trainer_name];

  if (shiny.catch_date) {
    pieces.push(shiny.catch_date);
  }

  if (Number.isInteger(shiny.total_encounters) && shiny.total_encounters > 0) {
    pieces.push(`${shiny.total_encounters.toLocaleString()} enc`);
  }

  if (shiny.is_secret && shiny.is_alpha) {
    pieces.push('Secret Alpha');
  } else if (shiny.is_secret) {
    pieces.push('Secret');
  } else if (shiny.is_alpha) {
    pieces.push('Alpha');
  }

  return pieces.join(' • ');
}

function removeVariantSelectorRows(components = []) {
  return components.filter(row => !row?.components?.some(component =>
    String(component?.custom_id || '').startsWith(`${COMPONENT_PREFIX}:r:v:`)
  ));
}

function extractShinyIdFromPayload(payload = {}) {
  for (const row of payload.components || []) {
    for (const component of row.components || []) {
      const customId = String(component?.custom_id || '');
      if (!customId.startsWith(`${COMPONENT_PREFIX}:`)) continue;
      try {
        const parsed = parseCustomId(customId);
        if (parsed.shinyId) return parsed.shinyId;
      } catch (error) {
        continue;
      }
    }
  }

  const footerText = payload.embeds?.[0]?.footer?.text;
  const match = String(footerText || '').match(/Shiny ID:\s*(.+)$/i);
  return match?.[1] || null;
}

async function getVariantSelectionConfig(pokemonName) {
  const variantData = await getPokemonVariants(pokemonName);
  const entries = (variantData?.entries || [])
    .filter(entry => entry?.value)
    .slice(0, MAX_VARIANT_SELECT_OPTIONS);

  if (entries.length <= 1) {
    return null;
  }

  return {
    entries,
    defaultEntry: entries.find(entry => entry.is_default) || entries[0],
  };
}

function buildVariantSelectorRow(shinyId, variantSelection, selectedVariant, state = null) {
  const selected = normalizeVariantSlug(selectedVariant) || variantSelection.defaultEntry.value;
  const customIdState = state || { scope: 'all', page: 1, pageSize: PAGE_SIZE_FALLBACK, shinyId };

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(buildCustomId('r', 'v', customIdState))
      .setPlaceholder('Select Variant')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(variantSelection.entries.map(entry => ({
        label: humanizeVariantLabel(entry.label || entry.value).slice(0, 100),
        value: entry.value,
        default: entry.value === selected,
        ...(entry.is_default ? { description: 'Default form' } : {}),
      })))
  );
}

async function ensureDefaultVariantForShiny(shiny, variantSelection) {
  if (!variantSelection?.defaultEntry?.value || !shiny?.id) {
    return shiny;
  }

  const currentVariant = normalizeVariantSlug(shiny.variants);
  const hasSelectableCurrentVariant = variantSelection.entries.some(entry => entry.value === currentVariant);

  if (hasSelectableCurrentVariant) {
    return shiny;
  }

  return updateShinyRecord(shiny.id, { variants: variantSelection.defaultEntry.value });
}

async function attachVariantSelectorToPayload(payload, shiny) {
  const variantSelection = await getVariantSelectionConfig(shiny?.pokemon || shiny?.pokemon_name);
  if (!variantSelection) {
    return { payload, shiny };
  }

  const updatedShiny = await ensureDefaultVariantForShiny(shiny, variantSelection);
  const selectedVariant = normalizeVariantSlug(updatedShiny?.variants) || variantSelection.defaultEntry.value;
  const variantRow = buildVariantSelectorRow(updatedShiny.id, variantSelection, selectedVariant);

  return {
    shiny: updatedShiny,
    payload: {
      ...payload,
      components: [
        variantRow,
        ...removeVariantSelectorRows(payload.components || []),
      ],
    },
  };
}

module.exports = {
  SHINY_MANAGER_ROLES,
  SHINY_STAFF_ROLES,
  PAGE_SIZE_FALLBACK,
  MAX_SHINY_SELECT_OPTIONS,
  MAX_VARIANT_SELECT_OPTIONS,
  COMPONENT_PREFIX,
  MODAL_PREFIX,
  SPECIAL_CHOICES,
  STATUS_CHOICES,
  FIELD_CODES,
  FIELDS_BY_CODE,
  getApiBaseUrl,
  getPublicApiBaseUrl,
  getAuthHeaders,
  updateShinyRecord,
  combineLocalDateTime,
  getTimezoneOption,
  getShinyCatchTimezone,
  getShinyCatchTime,
  getCatchTimeFields,
  getFieldByName,
  formatPokemonAutocompleteLabel,
  getPokemonDisplayName,
  getPokemonAutocompleteChoices,
  handlePokemonAutocomplete,
  getTimezoneAutocompleteChoices,
  handleShinyAutocomplete,
  normalizeVariantSlug,
  humanizeVariantLabel,
  isFailedShiny,
  isPublicHttpUrl,
  getGreyscaleSpriteUrl,
  normalizeEncounterType,
  formatEncounterType,
  getVariantValue,
  getStatusValue,
  normalizePageSize,
  encodeScope,
  decodeScope,
  buildCustomId,
  parseCustomId,
  getMemberRoles,
  hasAnyRole,
  assertCanManageShiny,
  buildIvString,
  formatShinySummary,
  removeVariantSelectorRows,
  extractShinyIdFromPayload,
  getVariantSelectionConfig,
  buildVariantSelectorRow,
  ensureDefaultVariantForShiny,
  attachVariantSelectorToPayload,
};
