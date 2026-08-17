const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('../discord/api');
const fetchClient = require('../fetchClient');
const { generateEncountersString } = require('../utils');
const { buildShinyTierField } = require('./shinyEmbedDetails');
const { capitalize, getSpriteUrl } = require('@team-soju/utils');
const {
  SHINY_MANAGER_ROLES,
  PAGE_SIZE_FALLBACK,
  COMPONENT_PREFIX,
  MODAL_PREFIX,
  FIELD_CODES,
  FIELDS_BY_CODE,
  encodeScope,
  decodeScope,
  buildCustomId,
  parseCustomId,
  getApiBaseUrl,
  getPublicApiBaseUrl,
  getAuthHeaders,
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
  getShinyDisplayName,
  isFailedShiny,
  getGreyscaleSpriteUrl,
  normalizeEncounterType,
  formatEncounterType,
  getVariantValue,
  getStatusValue,
  normalizePageSize,
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
} = Object.assign({}, require('./shinyCore'));

function buildShiniesEmbed(shinies, page, pageSize, title) {
  const totalPages = Math.ceil(shinies.length / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const pageItems = shinies.slice(startIndex, startIndex + pageSize);

  const description = pageItems.map((shiny, idx) => {
    const number = startIndex + idx + 1;
    return `${number}. **${getShinyDisplayName(shiny)}** - ${formatShinySummary(shiny)}`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle(title)
    .setDescription(description || 'No shinies found')
    .setFooter({ text: `Page ${page} of ${totalPages}` })
    .setTimestamp();
}

function getDefaultListState(shinyId = null) {
  return {
    scope: 'all',
    trainerId: null,
    page: 1,
    pageSize: PAGE_SIZE_FALLBACK,
    shinyId,
  };
}

function hasDefaultListContext(state = {}) {
  return encodeScope(state.scope) === 'a'
    && !state.trainerId
    && (Number(state.page) || 1) === 1
    && normalizePageSize(state.pageSize) === PAGE_SIZE_FALLBACK;
}

function buildModalCustomId(field, state) {
  const fieldCode = FIELD_CODES[field];
  if (!fieldCode) throw new Error('Unknown advanced text field.');

  if (hasDefaultListContext(state)) {
    return [MODAL_PREFIX, 'advanced', field, state.shinyId].join(':');
  }

  const componentCustomId = buildCustomId('m', fieldCode, state);
  return `${MODAL_PREFIX}:${componentCustomId.slice(COMPONENT_PREFIX.length + 1)}`;
}

function parseModalCustomId(customId) {
  const parts = String(customId || '').split(':');
  const [, action, fieldOrCode, legacyShinyId] = parts;

  if (action === 'advanced') {
    return { field: fieldOrCode, ...getDefaultListState(legacyShinyId) };
  }

  if (action !== 'm' || parts.length < 8) {
    throw new Error('Unknown shiny modal.');
  }

  const field = FIELDS_BY_CODE[fieldOrCode];
  if (!field) throw new Error('Unknown advanced text field.');

  const state = parseCustomId(`${COMPONENT_PREFIX}:${parts.slice(1).join(':')}`);
  return { ...state, field };
}

function getListTitle(state, memberIgn) {
  if (state.scope === 'mine') {
    return `Your Shinies (${memberIgn || 'linked account'})`;
  }
  if (state.scope === 'trainer') {
    return `Recent Shinies by ${memberIgn || 'trainer'}`;
  }
  return 'Recent Shinies';
}

async function fetchShinyById(shinyId) {
  const response = await fetchClient.get(`${getApiBaseUrl()}/shinies/${shinyId}`, getAuthHeaders());
  return response.data.data;
}

async function fetchMemberByIgn(trainerIgn) {
  const response = await fetchClient.get(`${getApiBaseUrl()}/members/ign/${trainerIgn}`, getAuthHeaders());
  return response.data.data;
}

async function fetchMemberByDiscordId(discordId) {
  const response = await fetchClient.get(`${getApiBaseUrl()}/members/discord/${discordId}`, getAuthHeaders());
  return response.data.data;
}

async function fetchShinies({ trainerId, limit = 10000 }) {
  const params = new URLSearchParams();
  params.append('limit', String(limit));

  if (trainerId) {
    params.append('trainer_id', trainerId.toString());
  }

  const response = await fetchClient.get(`${getApiBaseUrl()}/shinies?${params.toString()}`, getAuthHeaders());
  const shinies = response.data.data || [];

  shinies.sort((a, b) => new Date(b.catch_date || 0) - new Date(a.catch_date || 0));
  return shinies;
}

async function buildShinyDisplayPayload(shiny, titleOverride) {
  let spriteUrl = null;

  if (shiny.national_number) {
    try {
      spriteUrl = isFailedShiny(shiny)
        ? getGreyscaleSpriteUrl(shiny.national_number, shiny.variants)
          || await getSpriteUrl(shiny.national_number, { variant: shiny.variants })
        : await getSpriteUrl(shiny.national_number, { variant: shiny.variants });
    } catch (error) {
      console.error('Error fetching sprite URL:', error.message);
    }
  }

  const encountersString = generateEncountersString(shiny.total_encounters, shiny.species_encounters, shiny.pokemon);
  const embed = new EmbedBuilder()
    .setColor(isFailedShiny(shiny) ? 0x757575 : (shiny.is_secret || shiny.is_alpha ? 0xFFD700 : 0x4CAF50))
    .setTitle(titleOverride || `${getPokemonDisplayName(shiny)} (#${shiny.national_number})`);

  if (spriteUrl) embed.setThumbnail(spriteUrl);
  if (shiny.screenshot_url) embed.setImage(shiny.screenshot_url);

  embed.addFields(
    { name: 'Trainer', value: shiny.trainer_name, inline: true },
    ...[
      (() => {
        return {
          name: 'Pokemon',
          value: getShinyDisplayName(shiny),
          inline: true,
        };
      })(),
      { name: 'Status', value: getStatusValue(shiny), inline: true },
      shiny.catch_date ? { name: 'Catch Date', value: shiny.catch_date, inline: true } : null,
      ...getCatchTimeFields(shiny),
      buildShinyTierField(shiny),
      shiny.encounter_type ? { name: 'Encounter Type', value: formatEncounterType(shiny.encounter_type), inline: true } : null,
      encountersString ? { name: 'Encounters', value: encountersString, inline: true } : null,
      shiny.nature ? { name: 'Nature', value: capitalize(shiny.nature), inline: true } : null,
      buildIvString(shiny) ? { name: 'IVs (HP/Atk/Def/SpA/SpD/Spe)', value: buildIvString(shiny).replace(/,/g, '/'), inline: false } : null,
      shiny.is_secret ? { name: 'Secret Shiny', value: '✅', inline: true } : null,
      shiny.is_alpha ? { name: 'Alpha Shiny', value: '✅', inline: true } : null,
    ].filter(Boolean)
  )
    .setFooter({ text: `Shiny ID: ${shiny.id}` })
    .setTimestamp();

  return { embeds: [embed] };
}

async function buildFailedShinyPayload(shiny) {
  const status = shiny?.status || 'Owned';
  const embed = new EmbedBuilder()
    .setColor(0x757575)
    .setTitle('Shiny Status Updated')
    .setDescription(`${getPokemonDisplayName(shiny)} (#${shiny.national_number}) status set to ${status}`)
    .setFooter({ text: `Shiny ID: ${shiny.id}` })
    .setTimestamp();

  const spriteUrl = getGreyscaleSpriteUrl(shiny.national_number, shiny.variants)
    || await getSpriteUrl(shiny.national_number, { variant: shiny.variants }).catch(() => null);
  if (spriteUrl) {
    embed.setThumbnail(spriteUrl);
  }

  embed.addFields([
    { name: 'Trainer', value: shiny.trainer_name, inline: true },
    { name: 'Status', value: status, inline: true },
    shiny.catch_date ? { name: 'Catch Date', value: shiny.catch_date, inline: true } : null,
    ...getCatchTimeFields(shiny),
    shiny.encounter_type ? { name: 'Encounter Type', value: formatEncounterType(shiny.encounter_type), inline: true } : null,
  ].filter(Boolean));

  return { embeds: [embed] };
}

function buildStandaloneActionRow(shinyId, {
  includeView = false,
  includeEdit = false,
  includeDelete = false,
} = {}) {
  const state = { scope: 'all', page: 1, pageSize: PAGE_SIZE_FALLBACK, shinyId };
  const buttons = [];

  if (includeView) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(buildCustomId('a', 'v', state))
        .setLabel('View')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  if (includeEdit) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(buildCustomId('a', 'e', state))
        .setLabel('Edit')
        .setStyle(ButtonStyle.Primary)
    );
  }

  if (includeDelete) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(buildCustomId('a', 'd', state))
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger)
    );
  }

  return buttons.length > 0
    ? [new ActionRowBuilder().addComponents(...buttons)]
    : [];
}

async function buildShinyDetailsPayload(interaction, shinyId, titleOverride) {
  const shiny = await fetchShinyById(shinyId);
  const payload = await buildShinyDisplayPayload(shiny, titleOverride);
  if (hasAnyRole(interaction, SHINY_MANAGER_ROLES)) {
    payload.components = buildStandaloneActionRow(shinyId, {
      includeEdit: true,
      includeDelete: true,
    });
  }
  return payload;
}

async function sendShinyDetails(interaction, shinyId, replyMethod = 'editReply', titleOverride) {
  const payload = await buildShinyDetailsPayload(interaction, shinyId, titleOverride);
  await interaction[replyMethod](payload);
}

async function requireOwnedShiny(interaction, shinyId) {
  const shiny = await fetchShinyById(shinyId);
  await assertCanManageShiny(interaction, shiny);
  return shiny;
}

module.exports = {
  buildShiniesEmbed,
  encodeScope,
  decodeScope,
  getDefaultListState,
  hasDefaultListContext,
  buildCustomId,
  parseCustomId,
  buildModalCustomId,
  parseModalCustomId,
  getListTitle,
  fetchShinyById,
  fetchMemberByIgn,
  fetchMemberByDiscordId,
  fetchShinies,
  buildShinyDisplayPayload,
  buildFailedShinyPayload,
  buildStandaloneActionRow,
  buildShinyDetailsPayload,
  sendShinyDetails,
  requireOwnedShiny,
};
