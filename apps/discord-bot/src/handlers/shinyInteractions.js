const { MessageFlags } = require('../discord/api');
const { getNationalNumber, normalizeTimezoneInput } = require('@team-soju/utils');
const {
  FIELDS_BY_CODE,
  COMPONENT_PREFIX,
  MODAL_PREFIX,
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

async function handleShinyComponent(interaction) {
  try {
    if (String(interaction.customId || '').startsWith(`${COMPONENT_PREFIX}:pk:`)) {
      const pokemonPicker = parsePokemonPickerCustomId(interaction.customId);
      await requireOwnedShiny(interaction, pokemonPicker.shinyId);

      if (pokemonPicker.action === 'pick') {
        const pokemon = String(interaction.values[0] || '').trim().toLowerCase();
        const nationalNumber = await getNationalNumber(pokemon);
        if (!nationalNumber) {
          throw new Error(`Could not find national number for Pokemon "${pokemon}"`);
        }

        await updateShinyRecord(pokemonPicker.shinyId, {
          pokemon,
          national_number: nationalNumber,
        });
        await interaction.update(await buildEditControlsPayload(interaction, pokemonPicker, 'Pokemon updated.'));
        return;
      }
    }

    if (String(interaction.customId || '').startsWith(`${COMPONENT_PREFIX}:vp:`)) {
      const variantPicker = parseVariantPickerCustomId(interaction.customId);
      await requireOwnedShiny(interaction, variantPicker.shinyId);

      if (variantPicker.action === 'open') {
        await interaction.update(await buildVariantPickerPayload(variantPicker));
        return;
      }

      if (variantPicker.action === 'pick') {
        const selectedVariant = normalizeVariantSlug(interaction.values[0]);
        if (!selectedVariant) {
          throw new Error('Select a variant first.');
        }

        await updateShinyRecord(variantPicker.shinyId, { variants: selectedVariant });
        await interaction.update(await buildEditControlsPayload(interaction, variantPicker, 'Variant updated.'));
        return;
      }
    }

    if (String(interaction.customId || '').startsWith(`${COMPONENT_PREFIX}:fp:`)) {
      const fieldPicker = parseFieldPickerCustomId(interaction.customId);
      await requireOwnedShiny(interaction, fieldPicker.shinyId);

      if (fieldPicker.action === 'open') {
        await interaction.update(await buildFieldPickerPayload(fieldPicker.field, fieldPicker));
        return;
      }

      if (fieldPicker.action === 'pick') {
        if (fieldPicker.field === 'pokemon') {
          throw new Error('Pokemon picker must use the Pokemon browser.');
        }

        const shiny = await fetchShinyById(fieldPicker.shinyId);
        const config = getFieldPickerConfig(fieldPicker.field, shiny);
        if (!config) {
          throw new Error('Unknown field picker.');
        }

        await updateShinyRecord(fieldPicker.shinyId, config.toUpdates(interaction.values[0]));
        await interaction.update(await buildEditControlsPayload(interaction, fieldPicker, 'Shiny updated.'));
        return;
      }
    }

    if (String(interaction.customId || '').startsWith(`${COMPONENT_PREFIX}:tm:`)) {
      const parts = String(interaction.customId || '').split(':');
      const legacy = parts.length < 8;
      const state = legacy
        ? getDefaultListState(parts[3])
        : parseCustomId(interaction.customId);
      const field = legacy ? parts[2] : FIELDS_BY_CODE[state.action];
      const shiny = await requireOwnedShiny(interaction, state.shinyId);
      await interaction.showModal(buildAdvancedFieldModal(shiny, field, state));
      return;
    }

    const state = parseCustomId(interaction.customId);

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

    if (state.kind === 'r' && state.action === 'v') {
      await requireOwnedShiny(interaction, state.shinyId);
      const selectedVariant = normalizeVariantSlug(interaction.values[0]);

      if (!selectedVariant) {
        throw new Error('Select a variant first.');
      }

      await updateShinyRecord(state.shinyId, { variants: selectedVariant });
      await interaction.update(await buildVariantSelectionUpdatePayload(state.shinyId));
      return;
    }

    if (state.kind === 'e') {
      await requireOwnedShiny(interaction, state.shinyId);

      const selectedValue = interaction.values[0];
      const updates = {};

      if (state.action === 't') updates.encounter_type = normalizeEncounterType(selectedValue);
      if (state.action === 'n') updates.nature = selectedValue;
      if (state.action === 'v') {
        updates.is_secret = selectedValue === 'secret' || selectedValue === 'secret_alpha';
        updates.is_alpha = selectedValue === 'alpha' || selectedValue === 'secret_alpha';
      }
      if (state.action === 'f') updates.status = selectedValue;

      if (Object.keys(updates).length === 0) {
        throw new Error('Unknown edit selection.');
      }

      await updateShinyRecord(state.shinyId, updates);
      await interaction.update(await buildEditControlsPayload(interaction, state, 'Shiny updated.'));
      return;
    }

    if (state.kind === 'm' && state.action === 'o') {
      const shiny = await requireOwnedShiny(interaction, state.shinyId);
      await interaction.showModal(buildAdvancedFieldModal(shiny, 'catch_date', state));
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
      await interaction.update(await buildEditControlsPayload(
        interaction,
        state,
        'Use the Status dropdown to set whether this shiny is Owned, Sold, Fled, Died, or Bred.'
      ));
      return;
    }

    if (state.action === 'd') {
      const shiny = await requireOwnedShiny(interaction, state.shinyId);
      await deleteShinyRecord(state.shinyId);
      await interaction.update({ embeds: [buildDeleteSuccessEmbed(shiny)], components: [] });
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
  const state = parseModalCustomId(interaction.customId);
  const { field, shinyId } = state;

  try {
    await interaction.deferUpdate();
    const shiny = await requireOwnedShiny(interaction, shinyId);

    const updates = {};
    const value = interaction.fields.getTextInputValue(field)?.trim();

    if (field === 'catch_date' && value) {
      updates.catch_date = value;
      if (shiny.caught_at_utc) {
        const timezone = getShinyCatchTimezone(shiny);
        updates.caught_at_utc = combineLocalDateTime(value, getShinyCatchTime(shiny), timezone);
        updates.catch_timezone = timezone;
      }
    }
    if (field === 'catch_time' && value) {
      const timezone = getShinyCatchTimezone(shiny);
      updates.caught_at_utc = combineLocalDateTime(shiny.catch_date, value, timezone);
      updates.catch_timezone = timezone;
    }
    if (field === 'timezone' && value) {
      const timezone = normalizeTimezoneInput(value);
      if (!timezone) throw new Error('Timezone must be a valid IANA timezone, such as Australia/Melbourne.');
      updates.catch_timezone = timezone;
      if (shiny.caught_at_utc) {
        const existingLocalTime = getShinyCatchTime(shiny);
        updates.caught_at_utc = combineLocalDateTime(shiny.catch_date, existingLocalTime, timezone);
      }
    }
    if (field === 'ivs' && value) Object.assign(updates, parseIvInput(value));
    if (field === 'encounters' && value) Object.assign(updates, parseEncounterInput(value));

    if (Object.keys(updates).length === 0) {
      await interaction.followUp({ content: 'No updates provided.', flags: MessageFlags.Ephemeral });
      return;
    }

    await updateShinyRecord(shinyId, updates);
    await interaction.editReply(await buildEditControlsPayload(interaction, state, 'Shiny updated.'));
  } catch (error) {
    const payload = { content: `Error: ${error.message}`, flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  }
}

function isShinyEditModal(customId) {
  return String(customId || '').startsWith(`${MODAL_PREFIX}:advanced:`)
    || String(customId || '').startsWith(`${MODAL_PREFIX}:m:`);
}

module.exports = {
  handleShinyComponent,
  isShinyComponent,
  handleShinyEditModal,
  isShinyEditModal,
};
