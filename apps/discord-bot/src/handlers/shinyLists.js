const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('../discord/api');
const fetchClient = require('../fetchClient');
const { capitalize } = require('@team-soju/utils');
const {
  SHINY_MANAGER_ROLES,
  MAX_SHINY_SELECT_OPTIONS,
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
  getPokemonAutocompleteChoices,
  handlePokemonAutocomplete,
  getTimezoneAutocompleteChoices,
  handleShinyAutocomplete,
  normalizeVariantSlug,
  humanizeVariantLabel,
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
  sendShinyDetails,
  requireOwnedShiny,
  parseIvInput,
} = Object.assign({}, require('./shinyCore'), require('./shinyDisplay'));

async function deleteShinyRecord(shinyId) {
  const response = await fetchClient.delete(`${getApiBaseUrl()}/shinies/${shinyId}`, getAuthHeaders());
  return response.data.data;
}

function buildDeleteSuccessEmbed(shiny) {
  return new EmbedBuilder()
    .setColor(0xFF5722)
    .setTitle('Shiny Deleted Successfully')
    .setDescription(`${capitalize(shiny.pokemon)} (#${shiny.national_number}) has been removed`)
    .setTimestamp();
}

async function failShinyRecord(shinyId, status) {
  const response = await fetchClient.put(`${getApiBaseUrl()}/shinies/${shinyId}`, { status }, getAuthHeaders());
  return response.data.data;
}

function buildPaginationRow(page, totalPages, state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(buildCustomId('n', 'f', state))
      .setLabel('<<')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 1),
    new ButtonBuilder()
      .setCustomId(buildCustomId('n', 'p', state))
      .setLabel('<')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 1),
    new ButtonBuilder()
      .setCustomId(buildCustomId('n', 'n', state))
      .setLabel('>')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === totalPages),
    new ButtonBuilder()
      .setCustomId(buildCustomId('n', 'l', state))
      .setLabel('>>')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === totalPages)
  );
}

function buildSelectRow(pageItems, state) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(buildCustomId('s', 'pick', state))
    .setPlaceholder('Select a shiny')
    .setMinValues(1)
    .setMaxValues(1)
    .setDisabled(pageItems.length === 0)
    .addOptions(
      pageItems.slice(0, MAX_SHINY_SELECT_OPTIONS).map(shiny => ({
        label: capitalize(shiny.pokemon_name || shiny.pokemon).slice(0, 100),
        description: formatShinySummary(shiny).slice(0, 100),
        value: shiny.id,
        default: shiny.id === state.shinyId,
      }))
    );

  return new ActionRowBuilder().addComponents(select);
}

function buildActionRow(state, allowMutation) {
  const disabled = !state.shinyId;
  const buttons = [
    new ButtonBuilder()
      .setCustomId(buildCustomId('a', 'v', state))
      .setLabel('View')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  ];

  if (allowMutation) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(buildCustomId('a', 'e', state))
        .setLabel('Edit')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(buildCustomId('a', 'd', state))
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    );
  }

  return new ActionRowBuilder().addComponents(...buttons);
}

async function resolveListContext(interaction, state) {
  let trainerId = state.trainerId || null;
  let memberIgn = null;

  if (state.scope === 'mine') {
    const member = await fetchMemberByDiscordId(interaction.user.id);
    trainerId = member.id;
    memberIgn = member.ign;
  } else if (state.scope === 'trainer' && trainerId) {
    const trainer = await fetchClient.get(`${getApiBaseUrl()}/members/${trainerId}`, getAuthHeaders());
    memberIgn = trainer.data.data.ign;
  }

  const shinies = await fetchShinies({ trainerId });
  return {
    shinies,
    trainerId,
    title: getListTitle({ ...state, trainerId }, memberIgn),
  };
}

function clampPage(page, pageSize, shinies) {
  const totalPages = Math.ceil(shinies.length / pageSize) || 1;
  return Math.max(1, Math.min(page, totalPages));
}

function getSelectedShinyForPage(shinies, page, pageSize, preferredId) {
  const startIndex = (page - 1) * pageSize;
  const pageItems = shinies.slice(startIndex, startIndex + pageSize);

  if (preferredId && pageItems.some(shiny => shiny.id === preferredId)) {
    return preferredId;
  }

  return pageItems[0]?.id || null;
}

async function buildListPayload(interaction, state, content = null) {
  const { shinies, trainerId, title } = await resolveListContext(interaction, state);
  if (shinies.length === 0) {
    return { content: content || 'No shinies found', embeds: [], components: [] };
  }

  const pageSize = normalizePageSize(state.pageSize);
  const page = clampPage(state.page, pageSize, shinies);
  const selectedId = getSelectedShinyForPage(shinies, page, pageSize, state.shinyId);
  const totalPages = Math.ceil(shinies.length / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const pageItems = shinies.slice(startIndex, startIndex + pageSize);
  const normalizedState = { ...state, trainerId, page, pageSize, shinyId: selectedId };
  const allowMutation = hasAnyRole(interaction, SHINY_MANAGER_ROLES);

  return {
    content,
    embeds: [buildShiniesEmbed(shinies, page, pageSize, title)],
    components: [
      buildPaginationRow(page, totalPages, normalizedState),
      buildSelectRow(pageItems, normalizedState),
      buildActionRow(normalizedState, allowMutation),
    ],
  };
}

async function buildDetailPayload(interaction, state) {
  const shiny = await fetchShinyById(state.shinyId);
  const payload = await buildShinyDisplayPayload(shiny);
  const allowMutation = hasAnyRole(interaction, SHINY_MANAGER_ROLES);
  const backState = { ...state };

  const buttons = [
    new ButtonBuilder()
      .setCustomId(buildCustomId('d', 'b', backState))
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary),
  ];

  if (allowMutation) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(buildCustomId('a', 'e', backState))
        .setLabel('Edit')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(buildCustomId('a', 'd', backState))
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger)
    );
  }

  payload.components = [new ActionRowBuilder().addComponents(...buttons)];
  return payload;
}

module.exports = {
  deleteShinyRecord,
  buildDeleteSuccessEmbed,
  failShinyRecord,
  buildPaginationRow,
  buildSelectRow,
  buildActionRow,
  resolveListContext,
  clampPage,
  getSelectedShinyForPage,
  buildListPayload,
  buildDetailPayload,
};
