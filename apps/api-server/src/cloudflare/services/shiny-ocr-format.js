const { capitalize } = require('@team-soju/utils');

function formatEncounterType(value) {
  return ({
    x5_horde: '5x Horde', x3_horde: '3x Horde', horde: 'Horde', raid_den: 'Raid Den',
    mysterious_ball: 'Mysterious Ball', honey_tree: 'Honey Tree', rock_smash: 'Rock Smash',
  }[value] || capitalize(String(value || '').replace(/_/g, ' ')));
}

function buildActionComponents(shinyId) {
  return [{
    type: 1,
    components: [
      { type: 2, custom_id: `sh:a:v:a:_:1:10:${shinyId}`, label: 'View', style: 2 },
      { type: 2, custom_id: `sh:a:e:a:_:1:10:${shinyId}`, label: 'Edit', style: 1 },
      { type: 2, custom_id: `sh:a:d:a:_:1:10:${shinyId}`, label: 'Delete', style: 4 },
    ],
  }];
}

function buildNotesEmbed(notes) {
  if (!notes.length) return null;
  return {
    color: 0xFFB300,
    title: 'Screenshot Parsing Warnings',
    description: notes.map((note) => `- ${note}`).join('\n').slice(0, 4096),
  };
}

function buildSuccessPayload(shiny, notes, extractedFields) {
  const embeds = [{
    color: shiny.is_secret ? 0xFFD700 : 0x4CAF50,
    title: `${shiny.is_secret ? 'Secret ' : ''}Shiny Added!`,
    image: shiny.screenshot_url ? { url: shiny.screenshot_url } : undefined,
    fields: [
      { name: 'Trainer', value: shiny.trainer_name, inline: true },
      { name: 'Pokemon', value: `${capitalize(shiny.pokemon)} (#${shiny.national_number})`, inline: true },
      { name: 'Encounter Type', value: formatEncounterType(shiny.encounter_type), inline: true },
      ...extractedFields.slice(0, 21),
    ],
    footer: { text: `Shiny ID: ${shiny.id}` },
    timestamp: new Date().toISOString(),
  }];
  const notesEmbed = buildNotesEmbed(notes);
  if (notesEmbed) embeds.unshift(notesEmbed);
  return { embeds, components: buildActionComponents(shiny.id) };
}

function buildErrorPayload(error) {
  const detail = error?.ocrText ? `\nOCR result:\n\`\`\`\n${error.ocrText}\n\`\`\`` : '';
  return { content: `Error: ${error?.publicMessage || error?.message || 'Failed to create shiny entry from screenshot'}${detail}` };
}

function buildExtractedFields(parsed, timezone) {
  const fields = [
    { name: 'Catch Date', value: parsed.catchDate, inline: true },
    { name: 'Catch Time', value: `${parsed.catchTime} ${timezone}`, inline: true },
  ];
  if (parsed.nature) fields.push({ name: 'Nature', value: parsed.nature, inline: true });
  if (Number.isInteger(parsed.totalEncounters)) {
    const species = Number.isInteger(parsed.speciesEncounters)
      ? ` Total (${parsed.speciesEncounters.toLocaleString()} ${parsed.pokemon})`
      : '';
    fields.push({ name: 'Encounters', value: `${parsed.totalEncounters.toLocaleString()}${species}`, inline: !species });
  }
  if (parsed.ivs.every(Number.isInteger)) {
    fields.push({ name: 'IVs (HP/Atk/Def/SpA/SpD/Spe)', value: parsed.ivs.join('/'), inline: false });
  }
  return fields;
}

module.exports = { buildErrorPayload, buildExtractedFields, buildSuccessPayload };
