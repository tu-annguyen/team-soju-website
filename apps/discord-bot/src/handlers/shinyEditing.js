const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('../discord/api');
const fetchClient = require('../fetchClient');
const { ENCOUNTER_TYPE_CHOICES, NATURE_CHOICES } = require('../commands');
const { generateEncountersString } = require('../utils');
const { buildShinyTierField, enrichRawShinyEmbed } = require('./shinyEmbedDetails');
const { capitalize, getNationalNumber, getPokemonEvolutionLine, getPokemonVariants, getSpriteUrl, normalizeTimezoneInput } = require('@team-soju/utils');
const {
  SPECIAL_CHOICES,
  STATUS_CHOICES,
  COMPONENT_PREFIX,
  FIELD_CODES,
  FIELDS_BY_CODE,
  updateShinyRecord,
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
} = Object.assign({}, require('./shinyCore'), require('./shinyDisplay'));

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

function normalizeNatureInput(input) {
  if (!input) return null;

  const trimmed = String(input).trim();
  if (!trimmed) return null;

  const matchedNature = NATURE_CHOICES.find(choice => {
    const value = typeof choice === 'string' ? choice : choice.value;
    return String(value || '').toLowerCase() === trimmed.toLowerCase();
  });
  if (!matchedNature) {
    const allowedValues = NATURE_CHOICES.map(choice => typeof choice === 'string' ? choice : choice.value);
    throw new Error(`Nature must be one of: ${allowedValues.join(', ')}.`);
  }

  return String(typeof matchedNature === 'string' ? matchedNature : matchedNature.value);
}

function buildChoiceOptions(choices, currentValue) {
  const normalizedCurrentValue = typeof currentValue === 'string'
    ? currentValue.toLowerCase()
    : currentValue;

  return choices.map(choice => {
    const normalizedChoice = typeof choice === 'string'
      ? { name: capitalize(choice.replace(/_/g, ' ')), value: choice }
      : choice;

    return {
      label: normalizedChoice.name,
      value: normalizedChoice.value,
      default: String(normalizedChoice.value).toLowerCase() === normalizedCurrentValue,
    };
  });
}

function buildAdvancedFieldModal(shiny, field, state = {}) {
  const fieldConfigs = {
    catch_date: {
      label: 'Catch date (YYYY-MM-DD)',
      value: shiny.catch_date || '',
      customId: 'catch_date',
      title: 'Advanced Text Fields',
    },
    catch_time: {
      label: 'Local catch time (HH:MM)',
      value: getShinyCatchTime(shiny) || '',
      customId: 'catch_time',
      title: 'Edit Catch Time',
    },
    timezone: {
      label: 'Timezone (for example, Europe/London)',
      value: shiny.catch_timezone || (shiny.caught_at_utc ? 'UTC' : ''),
      customId: 'timezone',
      title: 'Edit Catch Timezone',
    },
    encounters: {
      label: 'Encounters (total,species)',
      value: `${shiny.total_encounters ?? ''},${shiny.species_encounters ?? ''}`,
      customId: 'encounters',
      title: 'Advanced Text Fields',
    },
    ivs: {
      label: 'IVs (hp,atk,def,spa,spd,spe)',
      value: buildIvString(shiny),
      customId: 'ivs',
      title: 'Advanced Text Fields',
    },
  };

  const config = fieldConfigs[field];
  if (!config) {
    throw new Error('Unknown advanced text field.');
  }

  const modal = new ModalBuilder()
    .setCustomId(buildModalCustomId(field, { ...state, shinyId: shiny.id }))
    .setTitle(config.title);

  const rows = [
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(config.customId)
        .setLabel(config.label)
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(config.value)
    ),
  ];

  modal.addComponents(...rows);

  return modal;
}

function buildPickerButton(customId, label, {
  style = ButtonStyle.Secondary,
  disabled = false,
} = {}) {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(style)
    .setDisabled(disabled);
}

function buildPokemonPickerSelectCustomId(state) {
  if (hasDefaultListContext(state)) {
    return `${COMPONENT_PREFIX}:pk:pick:${state.shinyId}`;
  }
  return buildCustomId('pk', 'p', state);
}

function parsePokemonPickerCustomId(customId) {
  const parts = String(customId || '').split(':');
  const [, kind, legacyAction, legacyShinyId] = parts;
  if (kind !== 'pk') {
    throw new Error('Unknown Pokemon picker interaction.');
  }

  if (parts.length >= 8) {
    const state = parseCustomId(customId);
    return { ...state, action: state.action === 'p' ? 'pick' : state.action };
  }

  return { action: legacyAction, shinyId: legacyShinyId, ...getDefaultListState(legacyShinyId) };
}

function buildFieldPickerCustomId(field, action, state) {
  const fieldCode = FIELD_CODES[field];
  if (!fieldCode) throw new Error('Unknown field picker.');
  if (hasDefaultListContext(state)) {
    return `${COMPONENT_PREFIX}:fp:${field}:${action}:${state.shinyId}`;
  }
  return buildCustomId('fp', `${fieldCode}${action === 'open' ? 'o' : 'p'}`, state);
}

function parseFieldPickerCustomId(customId) {
  const parts = String(customId || '').split(':');
  const [, kind, legacyField, legacyAction, legacyShinyId] = parts;
  if (kind !== 'fp') {
    throw new Error('Unknown field picker interaction.');
  }

  if (parts.length >= 8) {
    const state = parseCustomId(customId);
    const field = FIELDS_BY_CODE[state.action.charAt(0)];
    const action = state.action.charAt(1) === 'o' ? 'open' : 'pick';
    if (!field) throw new Error('Unknown field picker.');
    return { ...state, field, action };
  }

  return {
    field: legacyField,
    action: legacyAction,
    ...getDefaultListState(legacyShinyId),
  };
}

function buildVariantPickerCustomId(action, state) {
  if (hasDefaultListContext(state)) {
    return `${COMPONENT_PREFIX}:vp:${action}:${state.shinyId}`;
  }
  return buildCustomId('vp', action === 'open' ? 'o' : 'p', state);
}

function parseVariantPickerCustomId(customId) {
  const parts = String(customId || '').split(':');
  const [, kind, legacyAction, legacyShinyId] = parts;
  if (kind !== 'vp') {
    throw new Error('Unknown variant picker interaction.');
  }

  if (parts.length >= 8) {
    const state = parseCustomId(customId);
    return { ...state, action: state.action === 'o' ? 'open' : 'pick' };
  }

  return { action: legacyAction, ...getDefaultListState(legacyShinyId) };
}

function buildAdvancedFieldButtonCustomId(field, state) {
  const fieldCode = FIELD_CODES[field];
  if (!fieldCode) throw new Error('Unknown advanced text field.');
  if (hasDefaultListContext(state)) {
    return `${COMPONENT_PREFIX}:tm:${field}:${state.shinyId}`;
  }
  return buildCustomId('tm', fieldCode, state);
}

async function buildEditControlsPayload(interaction, state, content = null) {
  const shiny = await fetchShinyById(state.shinyId);
  const variantSelection = await getVariantSelectionConfig(shiny.pokemon || shiny.pokemon_name);
  const payload = await buildShinyDisplayPayload(shiny, `Edit ${getPokemonDisplayName(shiny)}`);
  payload.content = content || 'Choose a field to edit.';
  payload.components = [
    new ActionRowBuilder().addComponents(
      buildPickerButton(buildFieldPickerCustomId('pokemon', 'open', state), 'Pokemon', { style: ButtonStyle.Primary }),
      buildPickerButton(buildVariantPickerCustomId('open', state), 'Variant', {
        style: ButtonStyle.Primary,
        disabled: !variantSelection,
      })
    ),
    new ActionRowBuilder().addComponents(
      buildPickerButton(buildFieldPickerCustomId('encounter_type', 'open', state), 'Encounter Type'),
      buildPickerButton(buildFieldPickerCustomId('status', 'open', state), 'Status'),
      buildPickerButton(buildFieldPickerCustomId('nature', 'open', state), 'Nature')
    ),
    new ActionRowBuilder().addComponents(
      buildPickerButton(buildAdvancedFieldButtonCustomId('catch_date', state), 'Catch Date'),
      buildPickerButton(buildAdvancedFieldButtonCustomId('catch_time', state), 'Catch Time'),
      buildPickerButton(buildAdvancedFieldButtonCustomId('timezone', state), 'Timezone'),
      buildPickerButton(buildAdvancedFieldButtonCustomId('encounters', state), 'Encounters'),
      buildPickerButton(buildAdvancedFieldButtonCustomId('ivs', state), 'IVs')
    ),
    new ActionRowBuilder().addComponents(
      buildPickerButton(buildFieldPickerCustomId('special', 'open', state), 'Secret/Alpha'),
      new ButtonBuilder()
        .setCustomId(buildCustomId('d', 'b', state))
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
  return payload;
}

async function buildPokemonPickerPayload(state, content = null) {
  const shiny = await fetchShinyById(state.shinyId);
  const evolutionLine = await getPokemonEvolutionLine(shiny.pokemon || shiny.pokemon_name);
  const normalizedCurrentPokemon = String(shiny.pokemon || shiny.pokemon_name || '').trim().toLowerCase();
  const options = [...new Set((evolutionLine || []).filter(Boolean))];

  if (!options.includes(normalizedCurrentPokemon) && normalizedCurrentPokemon) {
    options.unshift(normalizedCurrentPokemon);
  }

  return {
    content: content || `Choose a Pokemon from the ${getPokemonDisplayName(shiny)} evolution line.`,
    embeds: (await buildShinyDisplayPayload(shiny, 'Choose Pokemon')).embeds,
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(buildPokemonPickerSelectCustomId(state))
          .setPlaceholder('Select Pokemon')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(options.map(name => ({
            label: formatPokemonAutocompleteLabel(name).slice(0, 100),
            value: name,
            default: name === String(shiny.pokemon || '').trim().toLowerCase(),
          })))
      ),
      new ActionRowBuilder().addComponents(
        buildPickerButton(buildCustomId('a', 'e', state), 'Back')
      ),
    ],
  };
}

async function buildVariantPickerPayload(state, content = null) {
  const shiny = await fetchShinyById(state.shinyId);
  const variantSelection = await getVariantSelectionConfig(shiny.pokemon || shiny.pokemon_name);
  if (!variantSelection) {
    return buildEditControlsPayload(null, state, 'This Pokemon has no alternate variants.');
  }

  return {
    content: content || 'Choose a variant.',
    embeds: (await buildShinyDisplayPayload(shiny, 'Choose Variant')).embeds,
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(buildVariantPickerCustomId('pick', state))
          .setPlaceholder('Select Variant')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(variantSelection.entries.map(entry => ({
            label: humanizeVariantLabel(entry.label || entry.value).slice(0, 100),
            value: entry.value,
            default: entry.value === (normalizeVariantSlug(shiny.variants) || variantSelection.defaultEntry.value),
            ...(entry.is_default ? { description: 'Default form' } : {}),
          })))
      ),
      new ActionRowBuilder().addComponents(
        buildPickerButton(buildCustomId('a', 'e', state), 'Back')
      ),
    ],
  };
}

function getFieldPickerConfig(field, shiny) {
  const configs = {
    encounter_type: {
      title: 'Choose Encounter Type',
      placeholder: 'Encounter Type',
      currentValue: shiny.encounter_type,
      choices: ENCOUNTER_TYPE_CHOICES,
      toUpdates: (value) => ({ encounter_type: normalizeEncounterType(value) }),
    },
    status: {
      title: 'Choose Status',
      placeholder: 'Status',
      currentValue: getStatusValue(shiny),
      choices: STATUS_CHOICES,
      toUpdates: (value) => ({ status: value }),
    },
    nature: {
      title: 'Choose Nature',
      placeholder: 'Nature',
      currentValue: shiny.nature,
      choices: NATURE_CHOICES,
      toUpdates: (value) => ({ nature: normalizeNatureInput(value) }),
    },
    special: {
      title: 'Choose Secret/Alpha',
      placeholder: 'Secret/Alpha',
      currentValue: getVariantValue(shiny),
      choices: SPECIAL_CHOICES,
      toUpdates: (value) => ({
        is_secret: value === 'secret' || value === 'secret_alpha',
        is_alpha: value === 'alpha' || value === 'secret_alpha',
      }),
    },
  };

  return configs[field] || null;
}

async function buildFieldPickerPayload(field, state, content = null) {
  if (field === 'pokemon') {
    return buildPokemonPickerPayload(state, content);
  }

  const shiny = await fetchShinyById(state.shinyId);
  const config = getFieldPickerConfig(field, shiny);
  if (!config) {
    throw new Error('Unknown field picker.');
  }

  return {
    content: content || 'Choose a value.',
    embeds: (await buildShinyDisplayPayload(shiny, config.title)).embeds,
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(buildFieldPickerCustomId(field, 'pick', state))
          .setPlaceholder(config.placeholder)
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(buildChoiceOptions(config.choices, config.currentValue))
      ),
      new ActionRowBuilder().addComponents(
        buildPickerButton(buildCustomId('a', 'e', state), 'Back')
      ),
    ],
  };
}

async function buildVariantSelectionUpdatePayload(shinyId, content = 'Shiny updated.') {
  const shiny = await fetchShinyById(shinyId);
  const payload = await buildShinyDisplayPayload(shiny, 'Shiny Updated Successfully');
  payload.content = content;
  payload.components = buildStandaloneActionRow(shinyId, {
    includeView: true,
    includeEdit: true,
    includeDelete: true,
  });

  return (await attachVariantSelectorToPayload(payload, shiny)).payload;
}

async function enhanceAsyncScreenshotPayload(payload) {
  const shinyId = extractShinyIdFromPayload(payload);
  if (!shinyId) {
    return payload;
  }

  try {
    const shiny = await fetchShinyById(shinyId);
    let enhanced = { payload, shiny };
    try {
      enhanced = await attachVariantSelectorToPayload(payload, shiny);
    } catch (error) {
      console.error('Error attaching variant selector to screenshot payload:', error.message);
    }
    const spriteUrl = enhanced.shiny.national_number
      ? await getSpriteUrl(enhanced.shiny.national_number, { variant: enhanced.shiny.variants }).catch(() => null)
      : null;
    const rawEmbed = (enhanced.payload.embeds || []).find(
      embed => embed?.footer?.text === `Shiny ID: ${enhanced.shiny.id}`
    );
    const rawFields = rawEmbed?.fields || [];
    const encountersString = generateEncountersString(
      enhanced.shiny.total_encounters,
      enhanced.shiny.species_encounters,
      enhanced.shiny.pokemon
    );
    const orderedFields = [
      { name: 'Trainer', value: enhanced.shiny.trainer_name, inline: true },
      {
        name: 'Pokemon',
        value: getPokemonDisplayName(enhanced.shiny),
        inline: true,
      },
      { name: 'Status', value: getStatusValue(enhanced.shiny), inline: true },
      enhanced.shiny.catch_date
        ? { name: 'Catch Date', value: enhanced.shiny.catch_date, inline: true }
        : getFieldByName(rawFields, 'Catch Date'),
      ...getCatchTimeFields(enhanced.shiny),
      buildShinyTierField(enhanced.shiny),
      enhanced.shiny.encounter_type
        ? { name: 'Encounter Type', value: formatEncounterType(enhanced.shiny.encounter_type), inline: true }
        : getFieldByName(rawFields, 'Encounter Type'),
      getFieldByName(rawFields, 'Encounters')
        || (encountersString ? { name: 'Encounters', value: encountersString, inline: true } : null),
      getFieldByName(rawFields, 'Nature'),
      getFieldByName(rawFields, 'IVs (HP/Atk/Def/SpA/SpD/Spe)'),
    ].filter(Boolean);
    return enrichRawShinyEmbed(enhanced.payload, enhanced.shiny, spriteUrl, orderedFields);
  } catch (error) {
    console.error('Error enriching screenshot success payload:', error.message);
    return payload;
  }
}

module.exports = {
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
};
