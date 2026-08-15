const { getPokemonTier } = require('@team-soju/utils');

function buildShinyTierField(shiny) {
  return {
    name: 'Shiny Tier',
    value: getPokemonTier(shiny?.pokemon_name || shiny?.pokemon) || 'Unknown',
    inline: true,
  };
}

function enrichRawShinyEmbed(payload, shiny, spriteUrl, orderedFields) {
  const shinyIdFooter = `Shiny ID: ${shiny.id}`;
  const embed = (payload.embeds || []).find(candidate => candidate?.footer?.text === shinyIdFooter);
  if (!embed) return payload;

  embed.fields = orderedFields || embed.fields || [];
  if (spriteUrl) {
    embed.thumbnail = { url: spriteUrl };
  }

  return payload;
}

module.exports = { buildShinyTierField, enrichRawShinyEmbed };
