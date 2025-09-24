const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

class TeamSojuBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api';
    this.botToken = process.env.BOT_API_TOKEN; // JWT token for API authentication
    
    this.setupEventHandlers();
    this.setupCommands();
  }

  setupEventHandlers() {
    this.client.once('ready', () => {
      console.log(`🤖 Discord bot logged in as ${this.client.user.tag}!`);
      this.registerSlashCommands();
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      try {
        await this.handleCommand(interaction);
      } catch (error) {
        console.error('Error handling command:', error);
        const errorMessage = 'There was an error executing this command!';
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    });
  }

  setupCommands() {
    this.commands = [
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
            .addChoices(
              { name: 'Member', value: 'Member' },
              { name: 'Veteran', value: 'Veteran' },
              { name: 'Officer', value: 'Officer' },
              { name: 'Co-Leader', value: 'Co-Leader' }
            )),

      new SlashCommandBuilder()
        .setName('addshiny')
        .setDescription('Add a new shiny catch')
        .addStringOption(option =>
          option.setName('trainer')
            .setDescription('Trainer IGN')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('pokemon')
            .setDescription('Pokemon Pokedex number')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('encounter_type')
            .setDescription('How was it encountered?')
            .setRequired(true)
            .addChoices(
              { name: 'Wild', value: 'wild' },
              { name: 'Horde', value: 'horde' },
              { name: 'Safari', value: 'safari' },
              { name: 'Fishing', value: 'fishing' },
              { name: 'Egg', value: 'egg' }
            ))
        .addIntegerOption(option =>
          option.setName('encounters')
            .setDescription('Total encounters')
            .setRequired(false))
        .addBooleanOption(option =>
          option.setName('secret')
            .setDescription('Is this a secret shiny?')
            .setRequired(false)),

      new SlashCommandBuilder()
        .setName('member')
        .setDescription('Get member information')
        .addStringOption(option =>
          option.setName('ign')
            .setDescription('Member IGN')
            .setRequired(true)),

      new SlashCommandBuilder()
        .setName('shinies')
        .setDescription('Get shiny information')
        .addStringOption(option =>
          option.setName('trainer')
            .setDescription('Filter by trainer IGN')
            .setRequired(false))
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Number of results to show')
            .setRequired(false)),

      new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Show shiny leaderboard')
        .addIntegerOption(option =>
          option.setName('limit')
            .setDescription('Number of top trainers to show')
            .setRequired(false)),

      new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Show team statistics')
    ];
  }

  async registerSlashCommands() {
    try {
      console.log('🔄 Registering slash commands...');
      
      const guild = this.client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
      if (guild) {
        await guild.commands.set(this.commands);
        console.log('✅ Guild slash commands registered successfully!');
      } else {
        await this.client.application.commands.set(this.commands);
        console.log('✅ Global slash commands registered successfully!');
      }
    } catch (error) {
      console.error('❌ Error registering slash commands:', error);
    }
  }

  async handleCommand(interaction) {
    const { commandName } = interaction;

    switch (commandName) {
      case 'addmember':
        await this.handleAddMember(interaction);
        break;
      case 'addshiny':
        await this.handleAddShiny(interaction);
        break;
      case 'member':
        await this.handleGetMember(interaction);
        break;
      case 'shinies':
        await this.handleGetShinies(interaction);
        break;
      case 'leaderboard':
        await this.handleLeaderboard(interaction);
        break;
      case 'stats':
        await this.handleStats(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown command!', ephemeral: true });
    }
  }

  async handleAddMember(interaction) {
    await interaction.deferReply();

    const ign = interaction.options.getString('ign');
    const discordUser = interaction.options.getUser('discord');
    const rank = interaction.options.getString('rank') || 'Member';

    try {
      const response = await axios.post(`${this.apiBaseUrl}/members`, {
        ign,
        discord_id: discordUser?.id,
        rank
      }, {
        headers: { Authorization: `Bearer ${this.botToken}` }
      });

      const embed = new EmbedBuilder()
        .setColor(0x4CAF50)
        .setTitle('✅ Member Added Successfully')
        .addFields(
          { name: 'IGN', value: ign, inline: true },
          { name: 'Rank', value: rank, inline: true },
          { name: 'Discord', value: discordUser ? `<@${discordUser.id}>` : 'Not linked', inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to add member';
      await interaction.editReply({ content: `❌ Error: ${errorMessage}` });
    }
  }

  async handleAddShiny(interaction) {
    await interaction.deferReply();

    const trainerIgn = interaction.options.getString('trainer');
    const pokemonNumber = interaction.options.getInteger('pokemon');
    const encounterType = interaction.options.getString('encounter_type');
    const encounters = interaction.options.getInteger('encounters') || 0;
    const isSecret = interaction.options.getBoolean('secret') || false;

    try {
      // First, get the trainer ID
      const memberResponse = await axios.get(`${this.apiBaseUrl}/members/ign/${trainerIgn}`, {
        headers: { Authorization: `Bearer ${this.botToken}` }
      });

      const trainerId = memberResponse.data.data.id;

      // Add the shiny
      const shinyResponse = await axios.post(`${this.apiBaseUrl}/shinies`, {
        pokedex_number: pokemonNumber,
        original_trainer: trainerId,
        catch_date: new Date().toISOString().split('T')[0],
        total_encounters: encounters,
        species_encounters: encounters,
        encounter_type: encounterType,
        is_secret: isSecret
      }, {
        headers: { Authorization: `Bearer ${this.botToken}` }
      });

      const embed = new EmbedBuilder()
        .setColor(isSecret ? 0xFFD700 : 0x4CAF50)
        .setTitle(`✨ ${isSecret ? 'Secret ' : ''}Shiny Added!`)
        .addFields(
          { name: 'Trainer', value: trainerIgn, inline: true },
          { name: 'Pokemon #', value: pokemonNumber.toString(), inline: true },
          { name: 'Encounter Type', value: encounterType, inline: true },
          { name: 'Encounters', value: encounters.toString(), inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to add shiny';
      await interaction.editReply({ content: `❌ Error: ${errorMessage}` });
    }
  }

  async handleGetMember(interaction) {
    await interaction.deferReply();

    const ign = interaction.options.getString('ign');

    try {
      const response = await axios.get(`${this.apiBaseUrl}/members/ign/${ign}`, {
        headers: { Authorization: `Bearer ${this.botToken}` }
      });

      const member = response.data.data;
      const embed = new EmbedBuilder()
        .setColor(0x2196F3)
        .setTitle(`👤 ${member.ign}`)
        .addFields(
          { name: 'Rank', value: member.rank, inline: true },
          { name: 'Join Date', value: new Date(member.join_date).toLocaleDateString(), inline: true },
          { name: 'Shinies', value: member.shiny_count.toString(), inline: true }
        )
        .setTimestamp();

      if (member.discord_id) {
        embed.addFields({ name: 'Discord', value: `<@${member.discord_id}>`, inline: true });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Member not found';
      await interaction.editReply({ content: `❌ Error: ${errorMessage}` });
    }
  }

  async handleGetShinies(interaction) {
    await interaction.deferReply();

    const trainer = interaction.options.getString('trainer');
    const limit = interaction.options.getInteger('limit') || 10;

    try {
      const params = new URLSearchParams();
      if (trainer) {
        // Get trainer ID first
        const memberResponse = await axios.get(`${this.apiBaseUrl}/members/ign/${trainer}`, {
          headers: { Authorization: `Bearer ${this.botToken}` }
        });
        params.append('trainer_id', memberResponse.data.data.id);
      }
      params.append('limit', limit.toString());

      const response = await axios.get(`${this.apiBaseUrl}/shinies?${params}`, {
        headers: { Authorization: `Bearer ${this.botToken}` }
      });

      const shinies = response.data.data;
      
      if (shinies.length === 0) {
        await interaction.editReply({ content: 'No shinies found!' });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`✨ Recent Shinies ${trainer ? `by ${trainer}` : ''}`)
        .setDescription(
          shinies.slice(0, 10).map(shiny => 
            `**${shiny.pokemon_name}** by ${shiny.trainer_name} (${shiny.encounter_type}${shiny.is_secret ? ' - Secret' : ''})`
          ).join('\n')
        )
        .setFooter({ text: `Showing ${Math.min(shinies.length, 10)} of ${shinies.length} shinies` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch shinies';
      await interaction.editReply({ content: `❌ Error: ${errorMessage}` });
    }
  }

  async handleLeaderboard(interaction) {
    await interaction.deferReply();

    const limit = interaction.options.getInteger('limit') || 10;

    try {
      const response = await axios.get(`${this.apiBaseUrl}/shinies/leaderboard?limit=${limit}`, {
        headers: { Authorization: `Bearer ${this.botToken}` }
      });

      const leaderboard = response.data.data;
      
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏆 Shiny Leaderboard')
        .setDescription(
          leaderboard.map((trainer, index) => 
            `**${index + 1}.** ${trainer.ign} - ${trainer.shiny_count} shinies ${trainer.secret_count > 0 ? `(${trainer.secret_count} secret)` : ''}`
          ).join('\n')
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch leaderboard';
      await interaction.editReply({ content: `❌ Error: ${errorMessage}` });
    }
  }

  async handleStats(interaction) {
    await interaction.deferReply();

    try {
      const [shiniesResponse, membersResponse] = await Promise.all([
        axios.get(`${this.apiBaseUrl}/shinies/stats`, {
          headers: { Authorization: `Bearer ${this.botToken}` }
        }),
        axios.get(`${this.apiBaseUrl}/members`, {
          headers: { Authorization: `Bearer ${this.botToken}` }
        })
      ]);

      const stats = shiniesResponse.data.data;
      const members = membersResponse.data.data;
      
      const totalShinies = stats.reduce((sum, stat) => sum + parseInt(stat.count_by_type), 0);
      const secretShinies = stats.reduce((sum, stat) => sum + parseInt(stat.secret_shinies || 0), 0);
      
      const embed = new EmbedBuilder()
        .setColor(0x9C27B0)
        .setTitle('📊 Team Soju Statistics')
        .addFields(
          { name: 'Total Members', value: members.length.toString(), inline: true },
          { name: 'Total Shinies', value: totalShinies.toString(), inline: true },
          { name: 'Secret Shinies', value: secretShinies.toString(), inline: true }
        )
        .setTimestamp();

      if (stats.length > 0) {
        const encounterTypes = stats.slice(0, 5).map(stat => 
          `${stat.encounter_type}: ${stat.count_by_type}`
        ).join('\n');
        embed.addFields({ name: 'Top Encounter Types', value: encounterTypes });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch statistics';
      await interaction.editReply({ content: `❌ Error: ${errorMessage}` });
    }
  }

  async start() {
    try {
      await this.client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
      console.error('❌ Failed to start Discord bot:', error);
    }
  }
}

// Start the bot if this file is run directly
if (require.main === module) {
  const bot = new TeamSojuBot();
  bot.start();
}

module.exports = TeamSojuBot;