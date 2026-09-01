const { EmbedBuilder } = require('../discord/api');

const DEPRECATED_SHINY_COMMAND_ACTIONS = {
  editshiny: 'edit your shinies',
  failshiny: 'fail your shinies',
  deleteshiny: 'delete your shinies',
  shiny: 'get your shinies',
};

function buildShinyCommandDeprecationWarning(commandName) {
  const action = DEPRECATED_SHINY_COMMAND_ACTIONS[commandName];
  if (!action) {
    throw new Error(`Unknown deprecated shiny command: ${commandName}`);
  }

  return new EmbedBuilder()
    .setColor(0xFFB300)
    .setTitle('Deprecated Command Warning')
    .setDescription(`The \`/${commandName}\` command is deprecated. Use \`/myshinies\` to ${action} instead.`);
}

function prependShinyCommandDeprecationWarning(payload, commandName) {
  return {
    ...payload,
    embeds: [
      buildShinyCommandDeprecationWarning(commandName),
      ...(payload.embeds || []),
    ],
  };
}

module.exports = {
  buildShinyCommandDeprecationWarning,
  prependShinyCommandDeprecationWarning,
};
