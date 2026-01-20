/**
 * Utility functions and constants for Discord Bot
 */

const { REST, Routes } = require('discord.js');

const API_ENDPOINT = 'https://discord.com/api/v10';

/**
 * Registers slash commands with Discord
 * @param {Array} commands - Array of SlashCommandBuilder instances
 * @param {string} clientId - Discord client ID
 * @param {string} token - Discord bot token
 * @param {string} guildId - Guild ID (optional, for guild-specific registration)
 */
async function registerSlashCommands(commands, clientId, token, guildId) {
  try {
    console.log(`🔄 Registering ${commands.length} slash commands...`);

    const rest = new REST({ version: '10' }).setToken(token);

    const route = guildId
      ? Routes.applicationGuildCommands(clientId, guildId)
      : Routes.applicationCommands(clientId);

    const commandData = commands.map(cmd => cmd.toJSON());

    await rest.put(route, { body: commandData });

    const scope = guildId ? 'Guild' : 'Global';
    console.log(`✅ ${scope} slash commands registered successfully!`);
  } catch (error) {
    console.error('❌ Error registering slash commands:', error);
    throw error;
  }
}

/**
 * Gets a handler module based on command name
 * @param {string} commandName - Name of the command
 * @returns {object} Handler functions from the appropriate module
 */
function getCommandHandlers(commandName) {
  const handlerMap = {
    // Member commands
    'addmember': 'memberHandlers',
    'editmember': 'memberHandlers',
    'deletemember': 'memberHandlers',
    'reactivatemember': 'memberHandlers',
    'member': 'memberHandlers',
    // Shiny commands
    'addshiny': 'shinyHandlers',
    'editshiny': 'shinyHandlers',
    'deleteshiny': 'shinyHandlers',
    'shiny': 'shinyHandlers',
    'shinies': 'shinyHandlers',
    // Stats commands
    'leaderboard': 'statsHandlers',
    'stats': 'statsHandlers',
  };

  const handlerModule = handlerMap[commandName];
  if (!handlerModule) {
    throw new Error(`No handler found for command: ${commandName}`);
  }

  return require(`./handlers/${handlerModule}`);
}

/**
 * Gets the correct handler function for a command
 * @param {string} commandName - Name of the command
 * @returns {function} Handler function
 */
function getCommandHandler(commandName) {
  const handlers = getCommandHandlers(commandName);

  const handlerNameMap = {
    'addmember': 'handleAddMember',
    'editmember': 'handleEditMember',
    'deletemember': 'handleDeleteMember',
    'reactivatemember': 'handleReactivateMember',
    'member': 'handleGetMember',
    'addshiny': 'handleAddShiny',
    'editshiny': 'handleEditShiny',
    'deleteshiny': 'handleDeleteShiny',
    'shiny': 'handleGetShiny',
    'shinies': 'handleGetShinies',
    'leaderboard': 'handleLeaderboard',
    'stats': 'handleStats',
  };

  const handlerName = handlerNameMap[commandName];
  if (!handlers[handlerName]) {
    throw new Error(`No handler function found for command: ${commandName}`);
  }

  return handlers[handlerName];
}

/**
 * Validates required environment variables
 * @param {Array<string>} required - Array of required env var names
 * @throws {Error} If any required env var is missing
 */
function validateEnvironment(required) {
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = {
  API_ENDPOINT,
  registerSlashCommands,
  getCommandHandlers,
  getCommandHandler,
  validateEnvironment,
};
