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
} = require('discord.js');
const axios = require('axios');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { parseDataFromOcr, validateParsedData, generateEncountersString, validateSojuTrainerIGN } = require('../utils');
const { capitalize, greyscale, getSpriteUrl, getNationalNumber } = require('@team-soju/utils');

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api';
const botToken = process.env.BOT_API_TOKEN;

const SHINIES_PAGE_PREFIX = 'shinies_page_';
const SHINIES_SELECT_PREFIX = 'shinies_select';
const SHINY_ACTION_PREFIX = 'shiny_action_';
const SHINY_EDIT_MODAL_PREFIX = 'shiny_modal_edit:';
const PAGE_SIZE_FALLBACK = 10;
const MAX_SHINY_SELECT_OPTIONS = 25;
const SHINY_MANAGER_ROLES = ['Soju', 'Elite 4', 'Champion'];
const SHINY_STAFF_ROLES = ['Elite 4', 'Champion'];

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
  const pieces = [capitalize(shiny.pokemon_name || shiny.pokemon)];

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
    return `${number}. **${capitalize(shiny.pokemon_name || shiny.pokemon)}** by ${shiny.trainer_name} - ${formatShinySummary(shiny)}`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle(title)
    .setDescription(description || 'No shinies found')
    .setFooter({ text: `Page ${page} of ${totalPages}` })
    .setTimestamp();
}

function buildPaginationRow(page, totalPages) {
  const first = new ButtonBuilder()
    .setCustomId(`${SHINIES_PAGE_PREFIX}first`)
    .setLabel('<<')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page === 1);

  const prev = new ButtonBuilder()
    .setCustomId(`${SHINIES_PAGE_PREFIX}prev`)
    .setLabel('<')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page === 1);

  const next = new ButtonBuilder()
    .setCustomId(`${SHINIES_PAGE_PREFIX}next`)
    .setLabel('>')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page === totalPages);

  const last = new ButtonBuilder()
    .setCustomId(`${SHINIES_PAGE_PREFIX}last`)
    .setLabel('>>')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page === totalPages);

  return new ActionRowBuilder().addComponents(first, prev, next, last);
}

function buildSelectRow(pageItems, selectedShinyId) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(SHINIES_SELECT_PREFIX)
    .setPlaceholder('Select a shiny to manage')
    .setMinValues(1)
    .setMaxValues(1)
    .setDisabled(pageItems.length === 0)
    .addOptions(
      pageItems.slice(0, MAX_SHINY_SELECT_OPTIONS).map(shiny => ({
        label: capitalize(shiny.pokemon_name || shiny.pokemon).slice(0, 100),
        description: formatShinySummary(shiny).slice(0, 100),
        value: shiny.id,
        default: shiny.id === selectedShinyId,
      }))
    );

  return new ActionRowBuilder().addComponents(select);
}

function buildActionRow(selectedShinyId, allowMutation) {
  const disabled = !selectedShinyId;
  const buttons = [
    new ButtonBuilder()
      .setCustomId(`${SHINY_ACTION_PREFIX}view`)
      .setLabel('View')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  ];

  if (allowMutation) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`${SHINY_ACTION_PREFIX}edit`)
        .setLabel('Edit')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`${SHINY_ACTION_PREFIX}fail`)
        .setLabel('Fail')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`${SHINY_ACTION_PREFIX}delete`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    );
  }

  return new ActionRowBuilder().addComponents(...buttons);
}

function buildShiniesComponents(shinies, page, pageSize, selectedShinyId, allowMutation) {
  const totalPages = Math.ceil(shinies.length / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const pageItems = shinies.slice(startIndex, startIndex + pageSize);

  return [
    buildPaginationRow(page, totalPages),
    buildSelectRow(pageItems, selectedShinyId),
    buildActionRow(selectedShinyId, allowMutation),
  ];
}

async function fetchShinyById(shinyId) {
  const response = await axios.get(`${apiBaseUrl}/shinies/${shinyId}`, getAuthHeaders());
  return response.data.data;
}

async function fetchMemberByIgn(trainerIgn) {
  const response = await axios.get(`${apiBaseUrl}/members/ign/${trainerIgn}`, getAuthHeaders());
  return response.data.data;
}

async function fetchMemberByDiscordId(discordId) {
  const response = await axios.get(`${apiBaseUrl}/members/discord/${discordId}`, getAuthHeaders());
  return response.data.data;
}

async function fetchShinies({ trainerId, limit = 10000 }) {
  const params = new URLSearchParams();
  params.append('limit', String(limit));

  if (trainerId) {
    params.append('trainer_id', trainerId.toString());
  }

  const response = await axios.get(`${apiBaseUrl}/shinies?${params.toString()}`, getAuthHeaders());
  const shinies = response.data.data || [];

  shinies.sort((a, b) => new Date(b.catch_date || 0) - new Date(a.catch_date || 0));
  return shinies;
}

async function buildShinyDisplayPayload(shiny) {
  const attachments = [];
  let spriteUrl = null;

  if (shiny.national_number) {
    try {
      spriteUrl = await getSpriteUrl(shiny.national_number);
    } catch (error) {
      console.error('Error fetching sprite URL:', error.message);
    }
  }

  if (spriteUrl && shiny.notes && shiny.notes.toLowerCase() === 'failed') {
    try {
      const greyscaledSprite = await greyscale(spriteUrl);
      attachments.push({ attachment: greyscaledSprite, name: 'sprite.gif' });
      spriteUrl = 'attachment://sprite.gif';
    } catch (error) {
      console.error('Greyscale failed for sprite:', error.message);
    }
  }

  const encountersString = generateEncountersString(shiny.total_encounters, shiny.species_encounters, shiny.pokemon);

  const embed = new EmbedBuilder()
    .setColor(shiny.is_secret || shiny.is_alpha ? 0xFFD700 : 0x4CAF50)
    .setTitle(`${capitalize(shiny.pokemon_name || shiny.pokemon)} (#${shiny.national_number})`);

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

  return { embeds: [embed], files: attachments };
}

async function sendShinyDetails(interaction, shinyId, replyMethod = 'editReply', extra = {}) {
  const shiny = await fetchShinyById(shinyId);
  const payload = await buildShinyDisplayPayload(shiny);
  await interaction[replyMethod]({ ...payload, ...extra });
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

async function buildEditModal(shinyId) {
  const shiny = await fetchShinyById(shinyId);

  const pokemonInput = new TextInputBuilder()
    .setCustomId('pokemon')
    .setLabel('Pokemon')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue(shiny.pokemon || '');

  const catchDateInput = new TextInputBuilder()
    .setCustomId('catch_date')
    .setLabel('Catch date (YYYY-MM-DD)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue(shiny.catch_date || '');

  const encounterTypeInput = new TextInputBuilder()
    .setCustomId('encounter_type')
    .setLabel('Encounter type')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue(shiny.encounter_type || '');

  const encountersInput = new TextInputBuilder()
    .setCustomId('encounters')
    .setLabel('Encounters (total,species)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue(`${shiny.total_encounters ?? ''},${shiny.species_encounters ?? ''}`);

  const ivsInput = new TextInputBuilder()
    .setCustomId('ivs')
    .setLabel('IVs (hp,atk,def,spa,spd,spe)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue(buildIvString(shiny));

  const modal = new ModalBuilder()
    .setCustomId(`${SHINY_EDIT_MODAL_PREFIX}${shinyId}`)
    .setTitle(`Edit ${capitalize(shiny.pokemon_name || shiny.pokemon)}`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(pokemonInput),
    new ActionRowBuilder().addComponents(catchDateInput),
    new ActionRowBuilder().addComponents(encounterTypeInput),
    new ActionRowBuilder().addComponents(encountersInput),
    new ActionRowBuilder().addComponents(ivsInput)
  );

  return modal;
}

async function updateShinyRecord(shinyId, updates) {
  const response = await axios.put(`${apiBaseUrl}/shinies/${shinyId}`, updates, getAuthHeaders());
  return response.data.data;
}

async function deleteShinyRecord(shinyId) {
  const response = await axios.delete(`${apiBaseUrl}/shinies/${shinyId}`, getAuthHeaders());
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
  const response = await axios.put(`${apiBaseUrl}/shinies/${shinyId}`, { notes: 'Failed' }, getAuthHeaders());
  return response.data.data;
}

function getSelectedShinyForPage(shinies, page, pageSize, preferredId) {
  const startIndex = (page - 1) * pageSize;
  const pageItems = shinies.slice(startIndex, startIndex + pageSize);

  if (preferredId && pageItems.some(shiny => shiny.id === preferredId)) {
    return preferredId;
  }

  return pageItems[0]?.id || null;
}

async function renderInteractiveShiniesList(interaction, { shinies, pageSize, title }) {
  const totalPages = Math.ceil(shinies.length / pageSize) || 1;
  let currentPage = 1;
  let selectedShinyId = getSelectedShinyForPage(shinies, currentPage, pageSize);
  const allowMutation = hasAnyRole(interaction, SHINY_MANAGER_ROLES);

  const embed = buildShiniesEmbed(shinies, currentPage, pageSize, title);
  const components = buildShiniesComponents(shinies, currentPage, pageSize, selectedShinyId, allowMutation);

  await interaction.editReply({ embeds: [embed], components });
  const message = await interaction.fetchReply();

  const filter = i =>
    i.user.id === interaction.user.id &&
    (i.customId.startsWith(SHINIES_PAGE_PREFIX) ||
      i.customId === SHINIES_SELECT_PREFIX ||
      i.customId.startsWith(SHINY_ACTION_PREFIX));

  const collector = message.createMessageComponentCollector({ filter, time: 600000 });

  collector.on('collect', async i => {
    try {
      if (i.customId.startsWith(SHINIES_PAGE_PREFIX)) {
        const action = i.customId.slice(SHINIES_PAGE_PREFIX.length);
        if (action === 'first') currentPage = 1;
        if (action === 'prev') currentPage = Math.max(1, currentPage - 1);
        if (action === 'next') currentPage = Math.min(totalPages, currentPage + 1);
        if (action === 'last') currentPage = totalPages;

        selectedShinyId = getSelectedShinyForPage(shinies, currentPage, pageSize, selectedShinyId);

        await i.update({
          embeds: [buildShiniesEmbed(shinies, currentPage, pageSize, title)],
          components: buildShiniesComponents(shinies, currentPage, pageSize, selectedShinyId, allowMutation),
        });
        return;
      }

      if (i.customId === SHINIES_SELECT_PREFIX) {
        selectedShinyId = i.values[0];
        await i.update({
          embeds: [buildShiniesEmbed(shinies, currentPage, pageSize, title)],
          components: buildShiniesComponents(shinies, currentPage, pageSize, selectedShinyId, allowMutation),
        });
        return;
      }

      const action = i.customId.slice(SHINY_ACTION_PREFIX.length);
      if (!selectedShinyId) {
        await i.reply({ content: 'Select a shiny first.', ephemeral: true });
        return;
      }

      if (action === 'view') {
        await sendShinyDetails(i, selectedShinyId, 'reply', { ephemeral: true });
        return;
      }

      if (action === 'edit') {
        const shiny = await requireOwnedShiny(i, selectedShinyId);
        const modal = await buildEditModal(shiny.id);
        await i.showModal(modal);
        return;
      }

      if (action === 'fail') {
        await requireOwnedShiny(i, selectedShinyId);
        const shiny = await failShinyRecord(selectedShinyId);
        const payload = await buildShinyDisplayPayload(shiny);
        if (payload.embeds[0]?.setTitle) {
          payload.embeds[0].setTitle('Shiny Marked as Failed');
        }
        await i.reply({ ...payload, ephemeral: true });
        return;
      }

      if (action === 'delete') {
        await requireOwnedShiny(i, selectedShinyId);
        const shiny = await deleteShinyRecord(selectedShinyId);
        const deleteEmbed = buildDeleteSuccessEmbed(shiny);
        shinies = shinies.filter(entry => entry.id !== selectedShinyId);

        if (shinies.length === 0) {
          collector.stop('empty');
          await i.update({
            content: 'No shinies found',
            embeds: [],
            components: [],
          });
          await i.followUp({ embeds: [deleteEmbed], ephemeral: true });
          return;
        }

        currentPage = Math.min(currentPage, Math.ceil(shinies.length / pageSize) || 1);
        selectedShinyId = getSelectedShinyForPage(shinies, currentPage, pageSize);

        await i.update({
          content: null,
          embeds: [buildShiniesEmbed(shinies, currentPage, pageSize, title)],
          components: buildShiniesComponents(shinies, currentPage, pageSize, selectedShinyId, allowMutation),
        });
        await i.followUp({ embeds: [deleteEmbed], ephemeral: true });
      }
    } catch (error) {
      const payload = { content: `Error: ${error.message}`, ephemeral: true };

      if (i.deferred || i.replied) {
        await i.followUp(payload).catch(() => {});
      } else {
        await i.reply(payload).catch(() => {});
      }
    }
  });

  collector.on('end', () => {
    const disabled = buildShiniesComponents(shinies, currentPage, pageSize, selectedShinyId, allowMutation).map(row => {
      row.components.forEach(component => component.setDisabled(true));
      return row;
    });

    message.edit({ components: disabled }).catch(() => {});
  });
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
    nationalNumber = await getNationalNumber(pokemon);
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

    const shinyResponse = await axios.post(`${apiBaseUrl}/shinies`, info, getAuthHeaders());
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

  const screenshotUrl = interaction.options.getAttachment('screenshot').url;
  const isMDY = interaction.options.getBoolean('date_is_mdy') || false;
  const encounterType = normalizeEncounterType(interaction.options.getString('encounter_type'));
  const isSecret = interaction.options.getBoolean('secret') || false;
  const isAlpha = interaction.options.getBoolean('alpha') || false;

  let data = {};

  const imageResponse = await axios.get(screenshotUrl, { responseType: 'arraybuffer' });
  const imageBuffer = Buffer.from(imageResponse.data);
  const processedBuffer = await sharp(imageBuffer)
    .greyscale()
    .normalise()
    .threshold(128)
    .sharpen({ sigma: 1 })
    .toBuffer();

  let ocrText;
  await Tesseract.recognize(
    processedBuffer,
    'eng',
    {
      tessedit_pageseg_mode: '6',
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/°: -_—'
    }
  ).then(async ({ data: { text } }) => {
    ocrText = text;
  }).catch(error => {
    console.error('OCR Error:', error);
    throw error;
  });

  if (!ocrText) {
    await interaction.editReply({ content: 'Failed to perform OCR on the image.' });
    return;
  }

  data = parseDataFromOcr(ocrText, isMDY);
  const validation = validateParsedData(data);
  if (!validation.isValid) {
    await interaction.editReply({
      content: `OCR validation failed: ${validation.error}\nOCR result:\n${codeBlock(ocrText)}\nTry uploading a high resolution desktop screenshot with minimal particles crowding the text areas or adding the shiny manually.`,
    });
    return;
  }

  const ignValidation = await validateSojuTrainerIGN(interaction, data.trainer);
  if (!ignValidation.valid) {
    await interaction.editReply({ content: `❌ ${ignValidation.reason}` });
    return;
  }

  let nationalNumber;
  try {
    nationalNumber = await getNationalNumber(data.name);
  } catch (error) {
    console.error('Error fetching national number:', error.message);
  }

  if (!nationalNumber) {
    await interaction.editReply({ content: `Error: Could not find national number for Pokemon "${data.name}"` });
    return;
  }

  let trainer;
  try {
    trainer = await fetchMemberByIgn(data.trainer);
  } catch (error) {
    await interaction.editReply({ content: `Error: Could not find trainer with IGN "${data.trainer}"` });
    return;
  }

  try {
    const body = {
      national_number: nationalNumber,
      pokemon: data.name,
      original_trainer: trainer.id,
      catch_date: data.date,
      encounter_type: encounterType,
      is_secret: isSecret,
      is_alpha: isAlpha,
      screenshot_url: screenshotUrl,
      total_encounters: Number.isInteger(data.totalEncounters) ? data.totalEncounters : 0,
      species_encounters: Number.isInteger(data.speciesEncounters) ? data.speciesEncounters : 0,
    };

    if (typeof data.nature === 'string' && data.nature.trim()) body.nature = data.nature;
    if (Number.isInteger(data.hp) && data.hp >= 0 && data.hp <= 31) body.iv_hp = data.hp;
    if (Number.isInteger(data.atk) && data.atk >= 0 && data.atk <= 31) body.iv_attack = data.atk;
    if (Number.isInteger(data.def) && data.def >= 0 && data.def <= 31) body.iv_defense = data.def;
    if (Number.isInteger(data.spa) && data.spa >= 0 && data.spa <= 31) body.iv_sp_attack = data.spa;
    if (Number.isInteger(data.spd) && data.spd >= 0 && data.spd <= 31) body.iv_sp_defense = data.spd;
    if (Number.isInteger(data.spe) && data.spe >= 0 && data.spe <= 31) body.iv_speed = data.spe;

    const shinyResponse = await axios.post(`${apiBaseUrl}/shinies`, body, getAuthHeaders());
    const shiny = shinyResponse.data.data;

    const embed = new EmbedBuilder()
      .setColor(isSecret ? 0xFFD700 : 0x4CAF50)
      .setTitle(`${isSecret ? 'Secret ' : ''}Shiny Added!`)
      .setImage(screenshotUrl)
      .addFields(
        { name: 'Trainer', value: data.trainer, inline: true },
        { name: 'Pokemon', value: `${data.name} (#${nationalNumber})`, inline: true },
        { name: 'Encounter Type', value: encounterType, inline: true },
        { name: 'Encounters', value: String(data.totalEncounters || 0), inline: true },
      )
      .setFooter({ text: `Shiny ID: ${shiny.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
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
      const nationalNumber = await getNationalNumber(pokemon);
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
    const payload = await buildShinyDisplayPayload(shiny);
    if (payload.embeds[0]?.setTitle) {
      payload.embeds[0].setTitle('Shiny Updated Successfully');
    }
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
    const payload = await buildShinyDisplayPayload(shiny);
    if (payload.embeds[0]?.setTitle) {
      payload.embeds[0].setTitle('Shiny Successfully Marked as Failed');
    }
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
    let trainerId = null;
    let title = 'Recent Shinies';

    if (trainerIgn) {
      const trainer = await fetchMemberByIgn(trainerIgn);
      trainerId = trainer.id;
      title = `Recent Shinies by ${trainerIgn}`;
    }

    const shinies = await fetchShinies({ trainerId });

    if (shinies.length === 0) {
      await interaction.editReply({ content: 'No shinies found' });
      return;
    }

    await renderInteractiveShiniesList(interaction, { shinies, pageSize, title });
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

async function handleGetMyShinies(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const pageSize = interaction.options.getInteger('limit') || PAGE_SIZE_FALLBACK;

  try {
    const member = await fetchMemberByDiscordId(interaction.user.id);
    const shinies = await fetchShinies({ trainerId: member.id });

    if (shinies.length === 0) {
      await interaction.editReply({ content: 'No shinies found for your linked account.' });
      return;
    }

    await renderInteractiveShiniesList(interaction, {
      shinies,
      pageSize,
      title: `Your Shinies (${member.ign})`,
    });
  } catch (error) {
    const message = error?.response?.status === 404
      ? 'Your Discord account is not linked to a team member.'
      : `Error: ${error.message}`;
    await interaction.editReply({ content: message });
  }
}

async function handleShinyEditModal(interaction) {
  const shinyId = interaction.customId.slice(SHINY_EDIT_MODAL_PREFIX.length);

  try {
    await requireOwnedShiny(interaction, shinyId);

    const pokemon = interaction.fields.getTextInputValue('pokemon')?.trim();
    const catchDate = interaction.fields.getTextInputValue('catch_date')?.trim();
    const encounterType = normalizeEncounterType(interaction.fields.getTextInputValue('encounter_type')?.trim());
    const encounters = interaction.fields.getTextInputValue('encounters')?.trim();
    const ivs = interaction.fields.getTextInputValue('ivs')?.trim();

    const updates = {};

    if (pokemon) {
      updates.pokemon = pokemon;
      const nationalNumber = await getNationalNumber(pokemon);
      if (!nationalNumber) {
        await interaction.reply({ content: `Error: Could not find national number for Pokemon "${pokemon}"`, ephemeral: true });
        return;
      }
      updates.national_number = nationalNumber;
    }

    if (catchDate) updates.catch_date = catchDate;
    if (encounterType) updates.encounter_type = encounterType;
    if (encounters) Object.assign(updates, parseEncounterInput(encounters));
    if (ivs) Object.assign(updates, parseIvInput(ivs));

    if (Object.keys(updates).length === 0) {
      await interaction.reply({ content: 'No updates provided.', ephemeral: true });
      return;
    }

    const shiny = await updateShinyRecord(shinyId, updates);
    const payload = await buildShinyDisplayPayload(shiny);
    if (payload.embeds[0]?.setTitle) {
      payload.embeds[0].setTitle('Shiny Updated Successfully');
    }
    await interaction.reply({ ...payload, ephemeral: true });
  } catch (error) {
    await interaction.reply({ content: `Error: ${error.message}`, ephemeral: true });
  }
}

function isShinyEditModal(customId) {
  return customId.startsWith(SHINY_EDIT_MODAL_PREFIX);
}

module.exports = {
  handleAddShiny,
  handleAddShinyScreenshot,
  handleEditShiny,
  handleFailShiny,
  handleDeleteShiny,
  handleGetShiny,
  handleGetShinies,
  handleGetMyShinies,
  handleShinyEditModal,
  isShinyEditModal,
};
