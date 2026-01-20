/**
 * Utility functions and constants for Discord Bot
 */

const { REST, Routes } = require('discord.js');
const { parse } = require('dotenv');

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
    'addshinyscreenshot': 'shinyHandlers',
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
    'addshinyscreenshot': 'handleAddShinyScreenshot',
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

/**
 * Parses stats from OCR text
 * @param {string} text - OCR text
 * @param {Boolean} isMDY - Date format (default: dmy)
 * @returns {object} Parsed data
 */
function parseDataFromOcr(text, isMDY = false) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  const date = (() => {
    const m = /(\d{1,2})\/(\d{1,2})\/(\d{1,2})/.exec(text);
    if (m) {
      let monthIndex, day;
      // Default is US format (DD/MM/YY)
      day = parseInt(m[1], 10);
      monthIndex = parseInt(m[2], 10) - 1;
      if (isMDY === true) {
        // If explicitly set to MDY, swap the values
        [monthIndex, day] = [parseInt(m[1], 10) - 1, parseInt(m[2], 10)];
      }
      const year = 2000 + parseInt(m[3], 10);
      return new Date(year, monthIndex, day);
    }
  })();
  
  const name = (() => {
    const m = /Shiny\s+([A-Za-z]+)/i.exec(text);
    if (m?.[1]) return m[1].trim();
    return lines.length ? lines[0] : null;
  })();

  const trainer = (() => {
    const m = /caught by\s+([A-Za-z0-9_]+)/i.exec(text);
    if (m?.[1]) return m[1].trim();
    return null;
  })();

  let hp = 0;
  let atk = 0;
  let def = 0;
  let spa = 0;
  let spd = 0;
  let spe = 0;

  const statSpread = /([0-9]|[12][0-9]|3[01])\/([0-9]|[12][0-9]|3[01])\/([0-9]|[12][0-9]|3[01])\/([0-9]|[12][0-9]|3[01])\/([0-9]|[12][0-9]|3[01])\/([0-9]|[12][0-9]|3[01])+/m.exec(text);
  const parts = statSpread?.[0].split('/').map(p => Number(p));
  console.log(statSpread);
  console.log("Parts: " + parts);

  if (parts?.length === 6 && parts?.every(n => Number.isFinite(n) && n >= 0 && n <= 31)) {
    console.log(parts); // [19,12,13,14,15,18]
    hp = parts[0];
    atk = parts[1];
    def = parts[2];
    spa = parts[3];
    spd = parts[4];
    spe = parts[5];
  } else {
    console.log('Invalid format or values out of range');
  }

  const nature = (() => {
    const m = /Nature:\s+([A-Za-z]+)/i.exec(text);
    if (m?.[1]) return m[1].trim();
    return null;
  })();

  const totalEncounters = (() => {
    const m = /Total Encounters:\s+(\d+)/i.exec(text);
    if (m?.[1]) return parseInt(m[1], 10);
    return null;
  })();

  const speciesEncounters = (() => {
    const m = new RegExp(`${name} Encounters:\\s+(\\d+)`, 'i').exec(text);
    if (m?.[1]) return parseInt(m[1], 10);
    return null;
  })();

  return { date, name, trainer, hp, atk, def, spa, spd, spe, nature, totalEncounters, speciesEncounters };
};

/** Fetches the national number for a given Pokémon name
 * @param {string} pokemon - Pokémon name
 * @returns {number|null} National number or null if not found
 */
async function getNationalNumber(pokemon) {
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemon}`);

    if (!response.ok) {
      console.error(`Failed to fetch data for Pokémon "${pokemon}": ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.id; // PokeAPI uses 'id' for national number
  } catch (err) {
    console.error(`Error fetching data for Pokémon "${pokemon}":`, err.message || err);
  }
}

module.exports = {
  API_ENDPOINT,
  registerSlashCommands,
  getCommandHandlers,
  getCommandHandler,
  validateEnvironment,
  parseDataFromOcr,
  getNationalNumber
};
