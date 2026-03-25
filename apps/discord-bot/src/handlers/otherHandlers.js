/**
 * Misc command handlers
 */

const { EmbedBuilder } = require('../discord/api');
const fetchClient = require('../fetchClient');

const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';
const SUPPORT_USER_ID = '272201126068092928';
const USEFUL_COMMANDS = [
  { name: 'shinies', description: 'List recent shinies' },
  { name: 'myshinies', description: 'List your recent shinies with mobile-friendly actions' },
  { name: 'addshiny', description: 'Add a new shiny catch' },
  { name: 'addshinyscreenshot', description: 'Add a shiny using a screenshot' },
];

function getDiscordBotToken(interaction) {
  return interaction.env?.DISCORD_TOKEN || process.env.DISCORD_TOKEN;
}

async function fetchRegisteredCommands(interaction) {
  const token = getDiscordBotToken(interaction);
  if (!token) {
    return [];
  }

  const headers = {
    Authorization: `Bot ${token}`,
  };
  const applicationId = interaction.applicationId;
  const commands = [];

  if (interaction.raw.guild_id) {
    const guildResponse = await fetchClient.get(
      `${DISCORD_API_BASE_URL}/applications/${applicationId}/guilds/${interaction.raw.guild_id}/commands`,
      { headers }
    );
    commands.push(...guildResponse.data);
  }

  const globalResponse = await fetchClient.get(
    `${DISCORD_API_BASE_URL}/applications/${applicationId}/commands`,
    { headers }
  );
  commands.push(...globalResponse.data);

  return commands;
}

async function buildUsefulCommandsField(interaction) {
  const commands = await fetchRegisteredCommands(interaction);
  const commandIdsByName = new Map();

  commands.forEach(command => {
    if (!commandIdsByName.has(command.name)) {
      commandIdsByName.set(command.name, command.id);
    }
  });

  return USEFUL_COMMANDS
    .map(({ name, description }) => {
      const commandId = commandIdsByName.get(name);
      const commandLabel = commandId ? `- </${name}:${commandId}>` : `/${name}`;
      return `${commandLabel} - ${description}`;
    })
    .join('\n');
}

async function handleHelp(interaction) {
  await interaction.deferReply();

  try {
    const usefulCommandsValue = await buildUsefulCommandsField(interaction);
    const embed = new EmbedBuilder()
      .setColor(0x757575)
      .setTitle('Help')
      .addFields(
        { name: 'Useful Commands', value: usefulCommandsValue },
        {
          name: 'All commands',
          value: 'For all commands and their example usages, visit the [documentation](https://github.com/tu-annguyen/team-soju-website/blob/main/apps/discord-bot/README.md#commands).',
        },
        { name: 'Need Help?', value: `Contact <@${SUPPORT_USER_ID}> for support.` },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

module.exports = {
  handleHelp,
};
