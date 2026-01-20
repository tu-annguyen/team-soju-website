/**
 * Command definitions for Team Soju Discord Bot
 * Slash commands for managing team members and shiny Pokemon
 */

const { SlashCommandBuilder } = require('discord.js');

const RANK_CHOICES = [
  { name: 'Trainer', value: 'Trainer' },
  { name: 'Ace Trainer', value: 'Ace Trainer' },
  { name: 'Gym Leader', value: 'Gym Leader' },
  { name: 'Elite 4', value: 'Elite 4' },
  { name: 'Champion', value: 'Champion' },
];

const ENCOUNTER_TYPE_CHOICES = [
  { name: 'Horde', value: 'horde' },
  { name: 'Single', value: 'single' },
  { name: 'Fishing', value: 'fishing' },
  { name: 'Safari', value: 'safari' },
  { name: 'Egg', value: 'egg' },
  { name: 'Mysterious Ball', value: 'mysterious_ball' },
  { name: 'Gift/Event', value: 'gift' },
];

const COMMANDS = [
  new SlashCommandBuilder()
    .setName('addmember')
    .setDescription('Add a new team member')
    .addStringOption(option =>
      option.setName('ign')
        .setDescription('In-game name')
        .setRequired(true))
    .addUserOption(option =>
      option.setName('discord')
        .setDescription('Discord user')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('rank')
        .setDescription('Member rank')
        .setRequired(false)
        .addChoices(...RANK_CHOICES)),

  new SlashCommandBuilder()
    .setName('editmember')
    .setDescription('Edit an existing team member')
    .addStringOption(option =>
      option.setName('ign')
        .setDescription('Current IGN of the member to edit')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('new_ign')
        .setDescription('New in-game name')
        .setRequired(false))
    .addUserOption(option =>
      option.setName('discord')
        .setDescription('Discord user')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('rank')
        .setDescription('Member rank')
        .setRequired(false)
        .addChoices(...RANK_CHOICES)),

  new SlashCommandBuilder()
    .setName('deletemember')
    .setDescription('Remove a team member')
    .addStringOption(option =>
      option.setName('ign')
        .setDescription('IGN of the member to remove')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('reactivatemember')
    .setDescription('Reactivate a previously removed team member')
    .addStringOption(option =>
      option.setName('ign')
        .setDescription('IGN of the member to reactivate')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('addshiny')
    .setDescription('Add a new shiny catch')
    .addStringOption(option =>
      option.setName('trainer')
        .setDescription('Trainer IGN')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('pokemon')
        .setDescription('Pokemon name')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('pokedex_number')
        .setDescription('Pokemon Pokedex number')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('encounter_type')
        .setDescription('How was it encountered?')
        .setRequired(true)
        .addChoices(...ENCOUNTER_TYPE_CHOICES))
    .addIntegerOption(option =>
      option.setName('encounters')
        .setDescription('Total encounters')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('secret')
        .setDescription('Is this a secret shiny?')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('addshinyscreenshot')
    .setDescription('Add a shiny using a screenshot')
    .addAttachmentOption(option =>
      option.setName('screenshot')
        .setDescription('Picture of the shiny\'s share screen')
        .setRequired(true))
    .addBooleanOption(option =>
      option.setName('date_is_mdy')
        .setDescription('Is the date format in MM/DD/YY? (default is DD/MM/YY)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('encounter_type')
        .setDescription('How was it encountered?')
        .setRequired(false)
        .addChoices(...ENCOUNTER_TYPE_CHOICES))
    .addBooleanOption(option =>
      option.setName('secret')
        .setDescription('Is this a secret shiny?')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('editshiny')
    .setDescription('Edit an existing shiny entry')
    .addStringOption(option =>
      option.setName('shiny_id')
        .setDescription('ID of the shiny to edit')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('pokemon')
        .setDescription('Pokemon name')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('pokedex_number')
        .setDescription('Pokemon Pokedex number')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('encounter_type')
        .setDescription('Encounter type')
        .setRequired(false)
        .addChoices(...ENCOUNTER_TYPE_CHOICES))
    .addIntegerOption(option =>
      option.setName('encounters')
        .setDescription('Total encounters')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('secret')
        .setDescription('Is this a secret shiny?')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('safari')
        .setDescription('Is this a safari shiny?')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('deleteshiny')
    .setDescription('Delete a shiny entry')
    .addStringOption(option =>
      option.setName('shiny_id')
        .setDescription('ID of the shiny to delete')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('member')
    .setDescription('Get member information')
    .addStringOption(option =>
      option.setName('ign')
        .setDescription('Member IGN')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('shiny')
    .setDescription('Get specific shiny information')
    .addStringOption(option =>
      option.setName('id')
        .setDescription('Shiny ID')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('shinies')
    .setDescription('List recent shinies')
    .addStringOption(option =>
      option.setName('trainer')
        .setDescription('Filter by trainer IGN')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Number of results to show (default: 10)')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show shiny leaderboard')
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Number of top trainers to show (default: 10)')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show team statistics'),
];

module.exports = { COMMANDS, RANK_CHOICES, ENCOUNTER_TYPE_CHOICES };
