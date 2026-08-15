const { EmbedBuilder, MessageFlags } = require('../discord/api');
const fetchClient = require('../fetchClient');
const { generateEncountersString, validateSojuTrainerIGN } = require('../utils');
const { buildShinyTierField } = require('./shinyEmbedDetails');
const { getNationalNumber, getPokemonVariants, getDateInTimezone, getTimeInTimezone, getSpriteUrl } = require('@team-soju/utils');
const {
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
  parseEncounterInput,
  normalizeNatureInput,
  buildChoiceOptions,
  buildAdvancedFieldModal,
  buildPickerButton,
  buildPokemonPickerSelectCustomId,
  parsePokemonPickerCustomId,
  buildFieldPickerCustomId,
  parseFieldPickerCustomId,
  buildVariantPickerCustomId,
  parseVariantPickerCustomId,
  buildAdvancedFieldButtonCustomId,
  buildEditControlsPayload,
  buildPokemonPickerPayload,
  buildVariantPickerPayload,
  getFieldPickerConfig,
  buildFieldPickerPayload,
  updateShinyRecord,
  buildVariantSelectionUpdatePayload,
  enhanceAsyncScreenshotPayload,
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
} = Object.assign({}, require('./shinyCore'), require('./shinyDisplay'), require('./shinyEditing'), require('./shinyLists'));

async function handleAddShiny(interaction) {
  await interaction.deferReply();

  const trainerIgn = interaction.options.getString('trainer');
  const ignValidation = await validateSojuTrainerIGN(interaction, trainerIgn);
  if (!ignValidation.valid) {
    await interaction.editReply({ content: `❌ ${ignValidation.reason}` });
    return;
  }

  const pokemon = interaction.options.getString('pokemon');
  const timezone = getTimezoneOption(interaction);
  const catchDate = interaction.options.getString('catch_date') || getDateInTimezone(new Date(), timezone);
  const catchTime = interaction.options.getString('catch_time') || getTimeInTimezone(new Date(), timezone);
  const encounterType = normalizeEncounterType(interaction.options.getString('encounter_type'));
  const status = interaction.options.getString('status') || 'Owned';
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
      ...(catchTime ? {
        caught_at_utc: combineLocalDateTime(catchDate, catchTime, timezone),
        catch_timezone: timezone,
      } : {}),
      encounter_type: encounterType,
      status,
      is_secret: isSecret,
      is_alpha: isAlpha,
      total_encounters: totalEncounters,
      species_encounters: speciesEncounters,
      ...ivUpdates,
    };

    if (nature) info.nature = nature;

    const shinyResponse = await fetchClient.post(`${getApiBaseUrl()}/shinies`, info, getAuthHeaders());
    const shiny = shinyResponse.data.data;
    const encountersString = generateEncountersString(shiny.total_encounters, shiny.species_encounters, shiny.pokemon);
    const spriteUrl = await getSpriteUrl(shiny.national_number).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(isSecret ? 0xFFD700 : 0x4CAF50)
      .setTitle(`${isSecret ? 'Secret ' : ''}Shiny Added!`);

    if (spriteUrl) embed.setThumbnail(spriteUrl);

    embed.addFields(
      { name: 'Trainer', value: shiny.trainer_name, inline: true },
      { name: 'Pokemon', value: `${shiny.pokemon} (#${shiny.national_number})`, inline: true },
      { name: 'Status', value: shiny.status || status, inline: true },
      { name: 'Catch Date', value: shiny.catch_date, inline: true },
      ...getCatchTimeFields(shiny),
      buildShinyTierField(shiny),
      ...[
        encounterType ? { name: 'Encounter Type', value: formatEncounterType(shiny.encounter_type), inline: true } : null,
        encountersString ? { name: 'Encounters', value: encountersString, inline: true } : null,
        nature ? { name: 'Nature', value: shiny.nature, inline: true } : null,
        buildIvString(shiny) ? { name: 'IVs (HP/Atk/Def/SpA/SpD/Spe)', value: buildIvString(shiny).replace(/,/g, '/'), inline: false } : null,
        isSecret ? { name: 'Secret Shiny', value: '✅', inline: true } : null,
        isAlpha ? { name: 'Alpha Shiny', value: '✅', inline: true } : null,
        (isSecret || isSafari) ? { name: 'Special', value: isSecret ? 'Secret' : 'Safari', inline: true } : null,
      ].filter(Boolean)
    )
      .setFooter({ text: `Shiny ID: ${shiny.id}` })
      .setTimestamp();

    const payload = { embeds: [embed] };
    payload.components = buildStandaloneActionRow(shiny.id, {
      includeView: true,
      includeEdit: true,
      includeDelete: true,
    });

    await interaction.editReply((await attachVariantSelectorToPayload(payload, shiny)).payload);
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

async function handleEditShiny(interaction) {
  await interaction.deferReply();

  const shinyId = interaction.options.getString('shiny_id');
  const pokemon = interaction.options.getString('pokemon');
  const variant = interaction.options.getString('variant');
  const catchDate = interaction.options.getString('catch_date');
  const catchTime = interaction.options.getString('catch_time');
  const timezone = getTimezoneOption(interaction);
  const encounterType = normalizeEncounterType(interaction.options.getString('encounter_type'));
  const status = interaction.options.getString('status');
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
    const existingShiny = await requireOwnedShiny(interaction, shinyId);

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
    if (variant) updates.variants = normalizeVariantSlug(variant);
    if (catchDate) updates.catch_date = catchDate;
    if (catchTime) {
      const effectiveDate = catchDate || existingShiny.catch_date;
      updates.caught_at_utc = combineLocalDateTime(effectiveDate, catchTime, timezone);
      updates.catch_timezone = timezone;
    } else if (catchDate && existingShiny.caught_at_utc) {
      const existingLocalTime = getTimeInTimezone(existingShiny.caught_at_utc, timezone);
      updates.caught_at_utc = combineLocalDateTime(catchDate, existingLocalTime, timezone);
      updates.catch_timezone = timezone;
    }
    if (encounterType) updates.encounter_type = encounterType;
    if (status) updates.status = status;
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
  const status = interaction.options.getString('status');

  try {
    await requireOwnedShiny(interaction, shinyId);
    const shiny = await failShinyRecord(shinyId, status);
    const payload = await buildFailedShinyPayload(shiny);
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
  const pageSize = normalizePageSize(interaction.options.getInteger('limit'));

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

  const pageSize = normalizePageSize(interaction.options.getInteger('limit'));

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

module.exports = {
  handleAddShiny,
  handleEditShiny,
  handleFailShiny,
  handleDeleteShiny,
  handleGetShiny,
  handleGetShinies,
  handleGetMyShinies,
};
