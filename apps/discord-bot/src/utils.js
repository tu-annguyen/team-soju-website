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

  let hp = null;
  let atk = null;
  let def = null;
  let spa = null;
  let spd = null;
  let spe = null;

  // Find IVs line and extract numbers
  const ivLine = lines.find(l => l.toLowerCase().includes('iv'));
  if (ivLine) {
    const parts = ivLine.split('/');
    const numbers = [];
    for (const part of parts) {
      const cleaned = part.replace(/[^0-9]/g, '');
      const num = parseInt(cleaned, 10);
      if (!isNaN(num) && num >= 0 && num <= 31) {
        numbers.push(num);
      } else if (!isNaN(num) && num > 31 && cleaned.length === 3) {
        // Try to split 3-digit number into two 2-digit
        const a = parseInt(cleaned.slice(0, 2), 10);
        const b = parseInt(cleaned.slice(2), 10);
        if (a >= 0 && a <= 31 && b >= 0 && b <= 31) {
          numbers.push(a, b);
        }
      }
    }
    if (numbers.length >= 6) {
      [hp, atk, def, spa, spd, spe] = numbers.slice(0, 6);
    }
  }

  const nature = (() => {
    const m = /N?atu?r?e?:\s+([A-Za-z]+)/i.exec(text);
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

/**
 * Validates parsed OCR data
 * @param {object} data - Parsed data from OCR
 * @returns {object} { isValid: boolean, error: string }
 */
function validateParsedData(data) {
  const validNatures = [
    'Hardy', 'Lonely', 'Adamant', 'Naughty', 'Brave', 'Bold', 'Docile', 'Impish', 'Lax', 'Relaxed',
    'Modest', 'Mild', 'Bashful', 'Rash', 'Quiet', 'Calm', 'Gentle', 'Careful', 'Quirky', 'Sassy',
    'Timid', 'Hasty', 'Jolly', 'Naive', 'Serious'
  ];

  // Check Pokemon name
  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    return { isValid: false, error: 'Pokemon name is missing or invalid.' };
  }

  // Check date
  if (!data.date || !(data.date instanceof Date) || isNaN(data.date)) {
    return { isValid: false, error: 'Date is missing or invalid.' };
  }

  // Check IVs
  const ivs = [data.hp, data.atk, data.def, data.spa, data.spd, data.spe];
  if (ivs.some(iv => typeof iv !== 'number' || iv < 0 || iv > 31 || !Number.isInteger(iv))) {
    return { isValid: false, error: 'IVs must be 6 integers between 0 and 31.' };
  }

  // Check encounters
  if (data.totalEncounters !== null && (typeof data.totalEncounters !== 'number' || !Number.isInteger(data.totalEncounters) || data.totalEncounters < 0)) {
    return { isValid: false, error: 'Total encounters must be a non-negative integer.' };
  }
  if (data.speciesEncounters !== null && (typeof data.speciesEncounters !== 'number' || !Number.isInteger(data.speciesEncounters) || data.speciesEncounters < 0)) {
    return { isValid: false, error: 'Species encounters must be a non-negative integer.' };
  }

  // Check nature
  if (data.nature && !validNatures.includes(data.nature)) {
    return { isValid: false, error: `Nature "${data.nature}" is not valid. Valid natures: ${validNatures.join(', ')}.` };
  }

  return { isValid: true, error: null };
}

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

/**
 * 
 * @param {*} pokemonId national pokedex number of the pokemon
 * @returns a URL to the Gen V animated shiny sprite associated with the pokemonId
 */
async function getSpriteUrl(pokemonId) {
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
    const data = await response.json();
    return data.sprites.versions["generation-v"]["black-white"].animated.front_shiny;
  } catch (err) {
    console.error(`Error fetching data for Pokémon "${pokemonId}":`, err.message || err);
    return null;
  }
}

/**
 * 
 * @param {*} total number of total encounters
 * @param {*} species number of species-specific encounters
 * @param {*} pokemon name of pokemon
 * @returns formatted encounters string
 */
function generateEncountersString(total, species, pokemon) {
  let encountersString;
  if (total === 0) {
    encountersString = null;
  } else if (species === 0) {
    encountersString = `${total}`;
  } else {
    encountersString = `${total} Total (${species} ${pokemon})`;
  }
  return encountersString;
}

module.exports = {
  API_ENDPOINT,
  registerSlashCommands,
  getCommandHandlers,
  getCommandHandler,
  validateEnvironment,
  parseDataFromOcr,
  validateParsedData,
  getNationalNumber,
  getSpriteUrl,
  generateEncountersString,
};
