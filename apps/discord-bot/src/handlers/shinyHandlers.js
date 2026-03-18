/**
 * Shiny command handlers
 */

const {
  EmbedBuilder,
  codeBlock,
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
const { ENCOUNTER_TYPE_CHOICES, NATURE_CHOICES } = require('../commands');
const { generateEncountersString, validateSojuTrainerIGN } = require('../utils');
const { capitalize, getPokemonNationalNumber, getSpriteUrl } = require('@team-soju/utils');

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api';
const botToken = process.env.BOT_API_TOKEN;

const SHINY_MANAGER_ROLES = ['Soju', 'Elite 4', 'Champion'];
const SHINY_STAFF_ROLES = ['Elite 4', 'Champion'];
const PAGE_SIZE_FALLBACK = 10;
const MAX_SHINY_SELECT_OPTIONS = 25;
const COMPONENT_PREFIX = 'sh';
const MODAL_PREFIX = 'shm';
const BOOLEAN_CHOICES = [
  { name: 'Yes', value: 'true' },
  { name: 'No', value: 'false' },
];

function getAuthHeaders() {
  return { headers: { Authorization: `Bearer ${botToken}` } };
}

function normalizeEncounterType(value) {
  if (!value) return null;
  return String(value).trim().toLowerCase().replace(/\s+/g, '_');
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

function buildShiniesEmbed(shinies, page, pageSize, title) {
  const totalPages = Math.ceil(shinies.length / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const pageItems = shinies.slice(startIndex, startIndex + pageSize);

  const description = pageItems.map((shiny, idx) => {
    const number = startIndex + idx + 1;
    return `${number}. **${capitalize(shiny.pokemon_name || shiny.pokemon)}** - ${formatShinySummary(shiny)}`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle(title)
    .setDescription(description || 'No shinies found')
    .setFooter({ text: `Page ${page} of ${totalPages}` })
    .setTimestamp();
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
  const pageSize = state.pageSize || PAGE_SIZE_FALLBACK;
  const shinyId = state.shinyId || '_';
  return [COMPONENT_PREFIX, kind, action, scope, trainerId, page, pageSize, shinyId].join(':');
}

function parseCustomId(customId) {
  const [prefix, kind, action, scopeCode, trainerId, page, pageSize, shinyId] = String(customId || '').split(':');
  if (prefix !== COMPONENT_PREFIX) {
    throw new Error('Unknown shiny interaction.');
  }

  return {
    kind,
    action,
    scope: decodeScope(scopeCode),
    trainerId: trainerId === '_' ? null : trainerId,
    page: Number(page) || 1,
    pageSize: Number(pageSize) || PAGE_SIZE_FALLBACK,
    shinyId: shinyId === '_' ? null : shinyId,
  };
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
  const response = await fetchClient.get(`${apiBaseUrl}/shinies/${shinyId}`, getAuthHeaders());
  return response.data.data;
}

async function fetchMemberByIgn(trainerIgn) {
  const response = await fetchClient.get(`${apiBaseUrl}/members/ign/${trainerIgn}`, getAuthHeaders());
  return response.data.data;
}

async function fetchMemberByDiscordId(discordId) {
  const response = await fetchClient.get(`${apiBaseUrl}/members/discord/${discordId}`, getAuthHeaders());
  return response.data.data;
}

async function fetchShinies({ trainerId, limit = 10000 }) {
  const params = new URLSearchParams();
  params.append('limit', String(limit));

  if (trainerId) {
    params.append('trainer_id', trainerId.toString());
  }

  const response = await fetchClient.get(`${apiBaseUrl}/shinies?${params.toString()}`, getAuthHeaders());
  const shinies = response.data.data || [];

  shinies.sort((a, b) => new Date(b.catch_date || 0) - new Date(a.catch_date || 0));
  return shinies;
}

async function buildShinyDisplayPayload(shiny, titleOverride) {
  let spriteUrl = null;

  if (shiny.national_number) {
    try {
      spriteUrl = await getSpriteUrl(shiny.national_number);
    } catch (error) {
      console.error('Error fetching sprite URL:', error.message);
    }
  }

  const encountersString = generateEncountersString(shiny.total_encounters, shiny.species_encounters, shiny.pokemon);
  const embed = new EmbedBuilder()
    .setColor(shiny.is_secret || shiny.is_alpha ? 0xFFD700 : 0x4CAF50)
    .setTitle(titleOverride || `${capitalize(shiny.pokemon_name || shiny.pokemon)} (#${shiny.national_number})`);

  if (spriteUrl) embed.setThumbnail(spriteUrl);
  if (shiny.screenshot_url) embed.setImage(shiny.screenshot_url);

  embed.addFields(
    { name: 'Trainer', value: shiny.trainer_name, inline: true },
    ...[
      shiny.catch_date ? { name: 'Catch Date', value: shiny.catch_date, inline: true } : null,
      shiny.encounter_type ? { name: 'Encounter Type', value: shiny.encounter_type, inline: true } : null,
      shiny.is_secret ? { name: 'Secret Shiny', value: '✅', inline: true } : null,
      shiny.is_alpha ? { name: 'Alpha Shiny', value: '✅', inline: true } : null,
      shiny.nature ? { name: 'Nature', value: shiny.nature, inline: true } : null,
      encountersString ? { name: 'Encounters', value: encountersString, inline: true } : null,
      buildIvString(shiny) ? { name: 'IVs (HP/Atk/Def/SpA/SpD/Spe)', value: buildIvString(shiny).replace(/,/g, '/'), inline: false } : null,
      shiny.notes ? { name: 'Notes', value: shiny.notes, inline: false } : null,
    ].filter(Boolean)
  )
    .setFooter({ text: `Shiny ID: ${shiny.id}` })
    .setTimestamp();

  return { embeds: [embed] };
}

async function sendShinyDetails(interaction, shinyId, replyMethod = 'editReply', titleOverride) {
  const shiny = await fetchShinyById(shinyId);
  const payload = await buildShinyDisplayPayload(shiny, titleOverride);
  await interaction[replyMethod](payload);
}

async function requireOwnedShiny(interaction, shinyId) {
  const shiny = await fetchShinyById(shinyId);
  await assertCanManageShiny(interaction, shiny);
  return shiny;
}

function parseIvInput(input) {
  if (!input) return null;

  const ivArray = input.split(',').map(iv => parseInt(iv.trim(), 10));
  if (ivArray.length !== 6 || ivArray.some(iv => Number.isNaN(iv) || iv < 0 || iv > 31)) {
    throw new Error('IVs must be a comma-separated list of 6 integers between 0 and 31.');
  }

  return {
    iv_hp: ivArray[0],
    iv_attack: ivArray[1],
    iv_defense: ivArray[2],
    iv_sp_attack: ivArray[3],
    iv_sp_defense: ivArray[4],
    iv_speed: ivArray[5],
  };
}

function parseEncounterInput(input) {
  if (!input) return null;

  const [totalRaw, speciesRaw] = input.split(',').map(value => value.trim());
  const updates = {};

  if (totalRaw) {
    const totalEncounters = parseInt(totalRaw, 10);
    if (Number.isNaN(totalEncounters) || totalEncounters < 0) {
      throw new Error('Total encounters must be a non-negative integer.');
    }
    updates.total_encounters = totalEncounters;
  }

  if (speciesRaw) {
    const speciesEncounters = parseInt(speciesRaw, 10);
    if (Number.isNaN(speciesEncounters) || speciesEncounters < 0) {
      throw new Error('Species encounters must be a non-negative integer.');
    }
    updates.species_encounters = speciesEncounters;
  }

  return updates;
}

function buildChoiceOptions(choices, currentValue) {
  return choices.map(choice => ({
    label: choice.name,
    value: choice.value,
    default: choice.value === currentValue,
  }));
}

function parseBooleanSelection(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function buildEditModal(shiny) {
  const modal = new ModalBuilder()
    .setCustomId([MODAL_PREFIX, 'edit', shiny.id].join(':'))
    .setTitle(`Edit ${capitalize(shiny.pokemon_name || shiny.pokemon)}`);

  const rows = [
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('pokemon')
        .setLabel('Pokemon')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(shiny.pokemon || '')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('catch_date')
        .setLabel('Catch date (YYYY-MM-DD)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(shiny.catch_date || '')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('encounters')
        .setLabel('Encounters (total,species)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(`${shiny.total_encounters ?? ''},${shiny.species_encounters ?? ''}`)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('ivs')
        .setLabel('IVs (hp,atk,def,spa,spd,spe)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(buildIvString(shiny))
    ),
  ];

  modal.addComponents(...rows);

  return modal;
}

async function buildEditControlsPayload(interaction, state, content = null) {
  const shiny = await fetchShinyById(state.shinyId);
  const payload = await buildShinyDisplayPayload(shiny, `Edit ${capitalize(shiny.pokemon_name || shiny.pokemon)}`);
  payload.content = content || [
    'Dropdowns:',
    '1. Encounter Type',
    '2. Nature',
    '3. Secret Shiny',
    '4. Alpha Shiny',
    'Use "Edit Text Fields" for pokemon, catch date, encounters, and IVs.',
  ].join('\n');
  payload.components = [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(buildCustomId('e', 't', state))
        .setPlaceholder('Encounter Type')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(buildChoiceOptions(ENCOUNTER_TYPE_CHOICES, shiny.encounter_type))
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(buildCustomId('e', 'n', state))
        .setPlaceholder('Nature')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(buildChoiceOptions(NATURE_CHOICES, shiny.nature))
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(buildCustomId('e', 's', state))
        .setPlaceholder('Secret Shiny')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(buildChoiceOptions(BOOLEAN_CHOICES, String(Boolean(shiny.is_secret))))
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(buildCustomId('e', 'a', state))
        .setPlaceholder('Alpha Shiny')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(buildChoiceOptions(BOOLEAN_CHOICES, String(Boolean(shiny.is_alpha))))
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(buildCustomId('m', 'o', state))
        .setLabel('Edit Text Fields')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(buildCustomId('d', 'b', state))
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
  return payload;
}

async function updateShinyRecord(shinyId, updates) {
  const response = await fetchClient.put(`${apiBaseUrl}/shinies/${shinyId}`, updates, getAuthHeaders());
  return response.data.data;
}

async function deleteShinyRecord(shinyId) {
  const response = await fetchClient.delete(`${apiBaseUrl}/shinies/${shinyId}`, getAuthHeaders());
  return response.data.data;
}

function buildDeleteSuccessEmbed(shiny) {
  return new EmbedBuilder()
    .setColor(0xFF5722)
    .setTitle('Shiny Deleted Successfully')
    .setDescription(`${capitalize(shiny.pokemon)} (#${shiny.national_number}) has been removed`)
    .setTimestamp();
}

async function failShinyRecord(shinyId) {
  const response = await fetchClient.put(`${apiBaseUrl}/shinies/${shinyId}`, { notes: 'Failed' }, getAuthHeaders());
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
        .setCustomId(buildCustomId('a', 'f', state))
        .setLabel('Fail')
        .setStyle(ButtonStyle.Secondary)
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
    const trainer = await fetchClient.get(`${apiBaseUrl}/members/${trainerId}`, getAuthHeaders());
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

  const page = clampPage(state.page, state.pageSize, shinies);
  const selectedId = getSelectedShinyForPage(shinies, page, state.pageSize, state.shinyId);
  const totalPages = Math.ceil(shinies.length / state.pageSize) || 1;
  const startIndex = (page - 1) * state.pageSize;
  const pageItems = shinies.slice(startIndex, startIndex + state.pageSize);
  const normalizedState = { ...state, trainerId, page, shinyId: selectedId };
  const allowMutation = hasAnyRole(interaction, SHINY_MANAGER_ROLES);

  return {
    content,
    embeds: [buildShiniesEmbed(shinies, page, state.pageSize, title)],
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
        .setCustomId(buildCustomId('a', 'f', backState))
        .setLabel('Fail')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(buildCustomId('a', 'd', backState))
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger)
    );
  }

  payload.components = [new ActionRowBuilder().addComponents(...buttons)];
  return payload;
}

async function handleAddShiny(interaction) {
  await interaction.deferReply();

  const trainerIgn = interaction.options.getString('trainer');
  const ignValidation = await validateSojuTrainerIGN(interaction, trainerIgn);
  if (!ignValidation.valid) {
    await interaction.editReply({ content: `❌ ${ignValidation.reason}` });
    return;
  }

  const pokemon = interaction.options.getString('pokemon');
  const catchDate = interaction.options.getString('catch_date') || new Date().toISOString().split('T')[0];
  const encounterType = normalizeEncounterType(interaction.options.getString('encounter_type'));
  const isSecret = interaction.options.getBoolean('secret') || false;
  const isAlpha = interaction.options.getBoolean('alpha') || false;
  const isSafari = encounterType === 'safari';
  const totalEncounters = interaction.options.getInteger('total_encounters') || 0;
  const speciesEncounters = interaction.options.getInteger('species_encounters') || 0;
  const nature = interaction.options.getString('nature');
  const ivs = interaction.options.getString('ivs');

  let ivUpdates = {};
  if (ivs) {
    ivUpdates = parseIvInput(ivs);
  }

  let nationalNumber;
  try {
    nationalNumber = await getPokemonNationalNumber(pokemon);
  } catch (error) {
    console.error('Error fetching national number:', error.message);
  }

  if (!nationalNumber) {
    await interaction.editReply({ content: `Error: Could not find national number for Pokemon "${pokemon}"` });
    return;
  }

  let trainer;
  try {
    trainer = await fetchMemberByIgn(trainerIgn);
  } catch (error) {
    await interaction.editReply({ content: `Error: Could not find trainer with IGN "${trainerIgn}"` });
    return;
  }

  try {
    const info = {
      original_trainer: trainer.id,
      pokemon,
      national_number: nationalNumber,
      catch_date: catchDate,
      encounter_type: encounterType,
      is_secret: isSecret,
      is_alpha: isAlpha,
      total_encounters: totalEncounters,
      species_encounters: speciesEncounters,
      ...ivUpdates,
    };

    if (nature) info.nature = nature;

    const shinyResponse = await fetchClient.post(`${apiBaseUrl}/shinies`, info, getAuthHeaders());
    const shiny = shinyResponse.data.data;
    const encountersString = generateEncountersString(shiny.total_encounters, shiny.species_encounters, shiny.pokemon);
    const spriteUrl = await getSpriteUrl(shiny.national_number).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(isSecret ? 0xFFD700 : 0x4CAF50)
      .setTitle(`${isSecret ? 'Secret ' : ''}Shiny Added!`);

    if (spriteUrl) embed.setThumbnail(spriteUrl);

    embed.addFields(
      { name: 'Pokemon', value: `${shiny.pokemon} (#${shiny.national_number})`, inline: true },
      { name: 'Trainer', value: shiny.trainer_name, inline: true },
      { name: 'Catch Date', value: shiny.catch_date, inline: true },
      ...[
        encounterType ? { name: 'Encounter Type', value: shiny.encounter_type, inline: true } : null,
        isSecret ? { name: 'Secret Shiny', value: '✅', inline: true } : null,
        isAlpha ? { name: 'Alpha Shiny', value: '✅', inline: true } : null,
        encountersString ? { name: 'Encounters', value: encountersString, inline: true } : null,
        nature ? { name: 'Nature', value: shiny.nature, inline: true } : null,
        buildIvString(shiny) ? { name: 'IVs (HP/Atk/Def/SpA/SpD/Spe)', value: buildIvString(shiny).replace(/,/g, '/'), inline: false } : null,
        (isSecret || isSafari) ? { name: 'Special', value: isSecret ? 'Secret' : 'Safari', inline: true } : null,
      ].filter(Boolean)
    )
      .setFooter({ text: `Shiny ID: ${shiny.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

async function handleAddShinyScreenshot(interaction) {
  await interaction.deferReply();

  try {
    const screenshot = interaction.options.getAttachment('screenshot');
    const response = await fetchClient.post(`${apiBaseUrl}/shinies/from-screenshot`, {
      screenshot_url: screenshot.url,
      date_is_mdy: interaction.options.getBoolean('date_is_mdy') || false,
      encounter_type: normalizeEncounterType(interaction.options.getString('encounter_type')),
      is_secret: interaction.options.getBoolean('secret') || false,
      is_alpha: interaction.options.getBoolean('alpha') || false,
      discord_user_id: interaction.user.id,
      member_roles: getMemberRoles(interaction).map(role => role.name),
    }, getAuthHeaders());

    const shiny = response.data.data;
    const embed = new EmbedBuilder()
      .setColor(shiny.is_secret ? 0xFFD700 : 0x4CAF50)
      .setTitle(`${shiny.is_secret ? 'Secret ' : ''}Shiny Added!`)
      .setImage(shiny.screenshot_url)
      .addFields(
        { name: 'Trainer', value: shiny.trainer_name, inline: true },
        { name: 'Pokemon', value: `${shiny.pokemon} (#${shiny.national_number})`, inline: true },
        { name: 'Encounter Type', value: shiny.encounter_type, inline: true },
        { name: 'Encounters', value: String(shiny.total_encounters || 0), inline: true },
      )
      .setFooter({ text: `Shiny ID: ${shiny.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    const details = error.response?.data?.details?.ocr_text
      ? `\nOCR result:\n${codeBlock(error.response.data.details.ocr_text)}`
      : '';
    await interaction.editReply({ content: `Error: ${error.response?.data?.message || error.message}${details}` });
  }
}

async function handleEditShiny(interaction) {
  await interaction.deferReply();

  const shinyId = interaction.options.getString('shiny_id');
  const pokemon = interaction.options.getString('pokemon');
  const catchDate = interaction.options.getString('catch_date');
  const encounterType = normalizeEncounterType(interaction.options.getString('encounter_type'));
  const isSecret = interaction.options.getBoolean('secret');
  const isAlpha = interaction.options.getBoolean('alpha');
  const totalEncounters = interaction.options.getInteger('total_encounters');
  const speciesEncounters = interaction.options.getInteger('species_encounters');
  const nature = interaction.options.getString('nature');
  const ivs = interaction.options.getString('ivs');
  const ivHp = interaction.options.getInteger('iv_hp');
  const ivAttack = interaction.options.getInteger('iv_attack');
  const ivDefense = interaction.options.getInteger('iv_defense');
  const ivSpAttack = interaction.options.getInteger('iv_sp_attack');
  const ivSpDefense = interaction.options.getInteger('iv_sp_defense');
  const ivSpeed = interaction.options.getInteger('iv_speed');

  try {
    await requireOwnedShiny(interaction, shinyId);

    const updates = {};
    if (pokemon) {
      updates.pokemon = pokemon;
      const nationalNumber = await getPokemonNationalNumber(pokemon);
      if (!nationalNumber) {
        await interaction.editReply({ content: `Error: Could not find national number for Pokemon "${pokemon}"` });
        return;
      }
      updates.national_number = nationalNumber;
    }
    if (catchDate) updates.catch_date = catchDate;
    if (encounterType) updates.encounter_type = encounterType;
    if (isSecret !== null) updates.is_secret = isSecret;
    if (isAlpha !== null) updates.is_alpha = isAlpha;
    if (totalEncounters !== null) updates.total_encounters = totalEncounters;
    if (speciesEncounters !== null) updates.species_encounters = speciesEncounters;
    if (nature) updates.nature = nature;
    if (ivs) Object.assign(updates, parseIvInput(ivs));
    if (ivHp !== null) updates.iv_hp = ivHp;
    if (ivAttack !== null) updates.iv_attack = ivAttack;
    if (ivDefense !== null) updates.iv_defense = ivDefense;
    if (ivSpAttack !== null) updates.iv_sp_attack = ivSpAttack;
    if (ivSpDefense !== null) updates.iv_sp_defense = ivSpDefense;
    if (ivSpeed !== null) updates.iv_speed = ivSpeed;

    if (Object.keys(updates).length === 0) {
      await interaction.editReply({ content: 'No updates provided' });
      return;
    }

    const shiny = await updateShinyRecord(shinyId, updates);
    const payload = await buildShinyDisplayPayload(shiny, 'Shiny Updated Successfully');
    await interaction.editReply(payload);
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

async function handleFailShiny(interaction) {
  await interaction.deferReply();

  const shinyId = interaction.options.getString('shiny_id');

  try {
    await requireOwnedShiny(interaction, shinyId);
    const shiny = await failShinyRecord(shinyId);
    const payload = await buildShinyDisplayPayload(shiny, 'Shiny Successfully Marked as Failed');
    await interaction.editReply(payload);
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

async function handleDeleteShiny(interaction) {
  await interaction.deferReply();

  const shinyId = interaction.options.getString('shiny_id');

  try {
    const shiny = await requireOwnedShiny(interaction, shinyId);
    await deleteShinyRecord(shinyId);
    await interaction.editReply({ embeds: [buildDeleteSuccessEmbed(shiny)] });
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

async function handleGetShiny(interaction) {
  await interaction.deferReply();

  const shinyId = interaction.options.getString('id');

  try {
    await sendShinyDetails(interaction, shinyId);
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

async function handleGetShinies(interaction) {
  await interaction.deferReply();

  const trainerIgn = interaction.options.getString('trainer');
  const pageSize = interaction.options.getInteger('limit') || PAGE_SIZE_FALLBACK;

  try {
    const state = { scope: trainerIgn ? 'trainer' : 'all', page: 1, pageSize };

    if (trainerIgn) {
      const trainer = await fetchMemberByIgn(trainerIgn);
      state.trainerId = trainer.id;
    }

    await interaction.editReply(await buildListPayload(interaction, state));
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

async function handleGetMyShinies(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const pageSize = interaction.options.getInteger('limit') || PAGE_SIZE_FALLBACK;

  try {
    await interaction.editReply(await buildListPayload(interaction, {
      scope: 'mine',
      page: 1,
      pageSize,
    }));
  } catch (error) {
    const message = error?.response?.status === 404
      ? 'Your Discord account is not linked to a team member.'
      : `Error: ${error.message}`;
    await interaction.editReply({ content: message });
  }
}

async function handleShinyComponent(interaction) {
  const state = parseCustomId(interaction.customId);

  try {
    if (state.kind === 's') {
      state.shinyId = interaction.values[0];
      await interaction.update(await buildListPayload(interaction, state));
      return;
    }

    if (state.kind === 'n') {
      if (state.action === 'f') state.page = 1;
      if (state.action === 'p') state.page -= 1;
      if (state.action === 'n') state.page += 1;
      if (state.action === 'l') {
        const { shinies } = await resolveListContext(interaction, state);
        state.page = Math.ceil(shinies.length / state.pageSize) || 1;
      }

      await interaction.update(await buildListPayload(interaction, state));
      return;
    }

    if (state.kind === 'd' && state.action === 'b') {
      await interaction.update(await buildListPayload(interaction, state));
      return;
    }

    if (state.kind === 'e') {
      await requireOwnedShiny(interaction, state.shinyId);

      const selectedValue = interaction.values[0];
      const updates = {};

      if (state.action === 't') updates.encounter_type = normalizeEncounterType(selectedValue);
      if (state.action === 'n') updates.nature = selectedValue;
      if (state.action === 's') updates.is_secret = parseBooleanSelection(selectedValue);
      if (state.action === 'a') updates.is_alpha = parseBooleanSelection(selectedValue);

      if (Object.keys(updates).length === 0) {
        throw new Error('Unknown edit selection.');
      }

      await updateShinyRecord(state.shinyId, updates);
      await interaction.update(await buildEditControlsPayload(interaction, state, 'Shiny updated.'));
      return;
    }

    if (state.kind === 'm' && state.action === 'o') {
      const shiny = await requireOwnedShiny(interaction, state.shinyId);
      await interaction.showModal(buildEditModal(shiny));
      return;
    }

    if (!state.shinyId) {
      await interaction.reply({ content: 'Select a shiny first.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (state.action === 'v') {
      await interaction.update(await buildDetailPayload(interaction, state));
      return;
    }

    if (state.action === 'e') {
      await requireOwnedShiny(interaction, state.shinyId);
      await interaction.update(await buildEditControlsPayload(interaction, state));
      return;
    }

    if (state.action === 'f') {
      await requireOwnedShiny(interaction, state.shinyId);
      await failShinyRecord(state.shinyId);
      await interaction.update(await buildListPayload(interaction, state, 'Shiny marked as failed.'));
      return;
    }

    if (state.action === 'd') {
      await requireOwnedShiny(interaction, state.shinyId);
      await deleteShinyRecord(state.shinyId);
      state.shinyId = null;
      await interaction.update(await buildListPayload(interaction, state, 'Shiny deleted.'));
    }
  } catch (error) {
    const payload = { content: `Error: ${error.message}`, flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  }
}

function isShinyComponent(customId) {
  return String(customId || '').startsWith(`${COMPONENT_PREFIX}:`);
}

async function handleShinyEditModal(interaction) {
  const [, action, shinyId] = String(interaction.customId || '').split(':');
  if (action !== 'edit') {
    throw new Error('Unknown shiny modal.');
  }

  try {
    await requireOwnedShiny(interaction, shinyId);

    const pokemon = interaction.fields.getTextInputValue('pokemon')?.trim();
    const catchDate = interaction.fields.getTextInputValue('catch_date')?.trim();
    const encounters = interaction.fields.getTextInputValue('encounters')?.trim();
    const ivs = interaction.fields.getTextInputValue('ivs')?.trim();

    const updates = {};

    if (pokemon) {
      updates.pokemon = pokemon;
      const nationalNumber = await getPokemonNationalNumber(pokemon);
      if (!nationalNumber) {
        await interaction.reply({ content: `Error: Could not find national number for Pokemon "${pokemon}"`, flags: MessageFlags.Ephemeral });
        return;
      }
      updates.national_number = nationalNumber;
    }

    if (catchDate) updates.catch_date = catchDate;
    if (encounters) Object.assign(updates, parseEncounterInput(encounters));
    if (ivs) Object.assign(updates, parseIvInput(ivs));

    if (Object.keys(updates).length === 0) {
      await interaction.reply({ content: 'No updates provided.', flags: MessageFlags.Ephemeral });
      return;
    }

    const shiny = await updateShinyRecord(shinyId, updates);
    const payload = await buildShinyDisplayPayload(shiny, 'Shiny Updated Successfully');
    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
  } catch (error) {
    await interaction.reply({ content: `Error: ${error.message}`, flags: MessageFlags.Ephemeral });
  }
}

function isShinyEditModal(customId) {
  return String(customId || '').startsWith(`${MODAL_PREFIX}:edit:`);
}

module.exports = {
  handleAddShiny,
  handleAddShinyScreenshot,
  handleDeleteShiny,
  handleEditShiny,
  handleFailShiny,
  handleGetMyShinies,
  handleGetShinies,
  handleGetShiny,
  handleShinyComponent,
  handleShinyEditModal,
  isShinyComponent,
  isShinyEditModal,
};
