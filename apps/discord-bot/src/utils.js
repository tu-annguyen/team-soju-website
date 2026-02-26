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

  // Find IVs using regex pattern
  const ivRegex = /((?:[0-9]|[12][0-9]|3[01])\/){5}(?:[0-9]|[12][0-9]|3[01])/;
  const ivMatch = ivRegex.exec(text);

  if (ivMatch) {
    const numbers = ivMatch[0].split('/').map(n => parseInt(n, 10));
    if (numbers.length === 6) {
      [hp, atk, def, spa, spd, spe] = numbers;
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
  console.log('Validating IVs:', ivs);
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

/**
 * 
 * @param {*} total number of total encounters
 * @param {*} species number of species-specific encounters
 * @param {*} pokemon name of pokemon
 * @returns formatted encounters string
 */
function generateEncountersString(total, species, pokemon) {
  let encountersString;
  if (total === 0 || total === null) {
    encountersString = null;
  } else if (species === 0 || species === null) {
    encountersString = `${total}`;
  } else {
    encountersString = `${total} Total (${species} ${pokemon})`;
  }
  return encountersString;
}

/**
 * Fetches a team member from the database by Discord ID
 * @param {string} discordId - Discord user ID
 * @returns {Promise<object|null>} Member object or null if not found
 */
async function getMemberByDiscordId(discordId) {
  const axios = require('axios');
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api';
  
  try {
    const response = await axios.get(`${apiBaseUrl}/members`, {
      headers: { Authorization: `Bearer ${process.env.BOT_API_TOKEN}` }
    });
    
    const members = response.data.data || [];
    return members.find(m => m.discord_id === discordId) || null;
  } catch (error) {
    console.error(`Error fetching member by Discord ID ${discordId}:`, error.message);
    return null;
  }
}

/**
 * Checks if a user has the required roles for a command
 * @param {Interaction} interaction - Discord interaction object
 * @param {Array<string>} requiredRoles - Array of required role names
 * @param {string} commandName - Name of the command being executed
 * @returns {Promise<{allowed: boolean, reason?: string}>} Permission check result
 */
async function checkCommandPermission(interaction, requiredRoles, commandName) {
  // If no roles are required, allow all members
  if (!requiredRoles || requiredRoles.length === 0) {
    return { allowed: true };
  }

  // Get member's roles
  const memberRoles = interaction.member?.roles?.cache;
  if (!memberRoles) {
    return { allowed: false, reason: 'Could not retrieve your roles' };
  }

  // Check if member has any of the required roles
  const hasRequiredRole = requiredRoles.some(requiredRole =>
    memberRoles.some(role => role.name === requiredRole)
  );

  if (!hasRequiredRole) {
    return { 
      allowed: false, 
      reason: `Required role(s): ${requiredRoles.join(', ')}` 
    };
  }

  // For Soju role, verify Discord ID is registered in the database
  const hasSojuRole = memberRoles.some(role => role.name === 'Soju');
  if (hasSojuRole && requiredRoles.includes('Soju')) {
    const member = await getMemberByDiscordId(interaction.user.id);
    if (!member) {
      return { 
        allowed: false, 
        reason: 'Your Discord account is not registered in the member database. Contact an Elite 4 or Champion to register.' 
      };
    }
  }

  return { allowed: true };
}

/**
 * Gets the required roles for a command
 * @param {string} commandName - Name of the command
 * @returns {Array<string>} Array of required role names
 */
function getCommandRequiredRoles(commandName) {
  const { COMMAND_PERMISSIONS } = require('./commands');
  return COMMAND_PERMISSIONS[commandName] || [];
}

/**
 * Validates that the trainer IGN matches the user's registered member IGN (for Soju role)
 * @param {Interaction} interaction - Discord interaction object
 * @param {string} trainerIGN - The IGN provided in the command
 * @returns {Promise<{valid: boolean, reason?: string, member?: object}>} Validation result
 */
async function validateSojuTrainerIGN(interaction, trainerIGN) {
  const memberRoles = interaction.member?.roles?.cache;
  const hasSojuRole = memberRoles?.some(role => role.name === 'Soju');
  const hasStaffRole = memberRoles?.some(role => role.name === 'Elite 4' || role.name === 'Champion');

  // Only validate for Soju-only role members (not if they also have Elite 4 or Champion)
  if (!hasSojuRole || hasStaffRole) {
    return { valid: true };
  }

  const member = await getMemberByDiscordId(interaction.user.id);
  if (!member) {
    return { 
      valid: false, 
      reason: 'Your Discord account is not registered in the member database.' 
    };
  }

  // Check if the provided trainer IGN matches their registered IGN
  if (member.ign.toLowerCase() !== trainerIGN.toLowerCase()) {
    return { 
      valid: false, 
      reason: `You can only manage shinies for your registered IGN: ${member.ign}` 
    };
  }

  return { valid: true, member };
}

module.exports = {
  API_ENDPOINT,
  registerSlashCommands,
  getCommandHandlers,
  getCommandHandler,
  validateEnvironment,
  parseDataFromOcr,
  validateParsedData,
  generateEncountersString,
  checkCommandPermission,
  getCommandRequiredRoles,
  getMemberByDiscordId,
  validateSojuTrainerIGN,
};
