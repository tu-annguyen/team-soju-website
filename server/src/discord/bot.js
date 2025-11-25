const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const TeamMember = require('../models/TeamMember');
const TeamShiny = require('../models/TeamShiny');
require('dotenv').config();

class TeamSojuBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
      ],
    });

    this.setupEventHandlers();
    this.setupCommands();
  }

  setupEventHandlers() {
    this.client.once('ready', () => {
      console.log(`🤖 Discord bot logged in as ${this.client.user.tag}!`);
      this.registerSlashCommands();
    });

    this.client.on('warn', console.warn);
    this.client.on('error', console.error);

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      console.log(`Command received: ${interaction.commandName} from ${interaction.user.tag}`);

      try {
        await this.handleCommand(interaction);
      } catch (error) {
        console.error(`Error handling ${interaction.commandName}:`, error);
        const errorMessage = `Error: ${error.message || 'Command execution failed'}`;

        if (interaction.deferred) {
          await interaction.editReply({ content: errorMessage, ephemeral: true });
        } else if (!interaction.replied) {
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
              { name: 'Trainer', value: 'Trainer' },
              { name: 'Ace Trainer', value: 'Ace Trainer' },
              { name: 'Gym Leader', value: 'Gym Leader' },
              { name: 'Elite 4', value: 'Elite 4' },
              { name: 'Champion', value: 'Champion' }
            )),

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
            .addChoices(
              { name: 'Trainer', value: 'Trainer' },
              { name: 'Ace Trainer', value: 'Ace Trainer' },
              { name: 'Gym Leader', value: 'Gym Leader' },
              { name: 'Elite 4', value: 'Elite 4' },
              { name: 'Champion', value: 'Champion' }
            )),

      new SlashCommandBuilder()
        .setName('deletemember')
        .setDescription('Remove a team member')
        .addStringOption(option =>
          option.setName('ign')
            .setDescription('IGN of the member to remove')
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
            .addChoices(
              { name: 'Single', value: 'single' },
              { name: 'Horde', value: 'horde' },
              { name: 'Safari', value: 'safari' },
              { name: 'Fishing', value: 'fishing' },
              { name: 'Egg', value: 'egg' },
              { name: 'Gift', value: 'gift' },
              { name: 'Trade', value: 'trade' },
              { name: 'Event', value: 'event' }
            ))
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
        .setName('editshiny')
        .setDescription('Edit an existing shiny entry')
        .addIntegerOption(option =>
          option.setName('shiny_id')
            .setDescription('ID of the shiny to edit (use /shiny to find ID)')
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
            .addChoices(
              { name: 'Single', value: 'single' },
              { name: 'Horde', value: 'horde' },
              { name: 'Safari', value: 'safari' },
              { name: 'Fishing', value: 'fishing' },
              { name: 'Egg', value: 'egg' },
              { name: 'Gift', value: 'gift' },
              { name: 'Trade', value: 'trade' },
              { name: 'Event', value: 'event' }
            ))
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
        .addIntegerOption(option =>
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
        .addIntegerOption(option =>
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
  }

  async registerSlashCommands() {
    try {
      console.log('🔄 Registering slash commands...');
      
      const guild = this.client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
      if (guild) {
        await guild.commands.set([]); // Clear existing commands
        await guild.commands.set(this.commands);
        console.log('✅ Guild slash commands registered successfully!');
      } else {
        await this.client.application.commands.set([]); // Clear existing commands
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
      case 'editmember':
        await this.handleEditMember(interaction);
        break;
      case 'deletemember':
        await this.handleDeleteMember(interaction);
        break;
      case 'addshiny':
        await this.handleAddShiny(interaction);
        break;
      case 'editshiny':
        await this.handleEditShiny(interaction);
        break;
      case 'deleteshiny':
        await this.handleDeleteShiny(interaction);
        break;
      case 'member':
        await this.handleGetMember(interaction);
        break;
      case 'shiny':
        await this.handleGetShiny(interaction);
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
    const rank = interaction.options.getString('rank') || 'Trainer';

    try {
      const member = await TeamMember.create({
        ign,
        discord_id: discordUser?.id,
        rank
      });

      const embed = new EmbedBuilder()
        .setColor(0x4CAF50)
        .setTitle('Member Added Successfully')
        .addFields(
          { name: 'IGN', value: ign, inline: true },
          { name: 'Rank', value: rank, inline: true },
          { name: 'Discord', value: discordUser ? `<@${discordUser.id}>` : 'Not linked', inline: true }
        )
        .setFooter({ text: `Member ID: ${member.id}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const errorMessage = error.code === '23505'
        ? 'A member with this IGN or Discord ID already exists'
        : error.message;
      await interaction.editReply({ content: `Error: ${errorMessage}` });
    }
  }

  async handleEditMember(interaction) {
    await interaction.deferReply();

    const ign = interaction.options.getString('ign');
    const newIgn = interaction.options.getString('new_ign');
    const discordUser = interaction.options.getUser('discord');
    const rank = interaction.options.getString('rank');

    try {
      const member = await TeamMember.findByIgn(ign);
      if (!member) {
        await interaction.editReply({ content: `Member "${ign}" not found` });
        return;
      }

      const updates = {};
      if (newIgn) updates.ign = newIgn;
      if (discordUser) updates.discord_id = discordUser.id;
      if (rank) updates.rank = rank;

      if (Object.keys(updates).length === 0) {
        await interaction.editReply({ content: 'No updates provided' });
        return;
      }

      const updatedMember = await TeamMember.update(member.id, updates);

      const embed = new EmbedBuilder()
        .setColor(0x2196F3)
        .setTitle('Member Updated Successfully')
        .addFields(
          { name: 'IGN', value: updatedMember.ign, inline: true },
          { name: 'Rank', value: updatedMember.rank, inline: true },
          { name: 'Discord', value: updatedMember.discord_id ? `<@${updatedMember.discord_id}>` : 'Not linked', inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `Error: ${error.message}` });
    }
  }

  async handleDeleteMember(interaction) {
    await interaction.deferReply();

    const ign = interaction.options.getString('ign');

    try {
      const member = await TeamMember.findByIgn(ign);
      if (!member) {
        await interaction.editReply({ content: `Member "${ign}" not found` });
        return;
      }

      await TeamMember.delete(member.id);

      const embed = new EmbedBuilder()
        .setColor(0xFF5722)
        .setTitle('Member Removed Successfully')
        .setDescription(`${ign} has been deactivated from the team`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `Error: ${error.message}` });
    }
  }

  async handleAddShiny(interaction) {
    await interaction.deferReply();

    const trainerIgn = interaction.options.getString('trainer');
    const pokemon = interaction.options.getString('pokemon');
    const nationalNumber = interaction.options.getInteger('pokedex_number');
    const encounterType = interaction.options.getString('encounter_type');
    const encounters = interaction.options.getInteger('encounters') || 0;
    const isSecret = interaction.options.getBoolean('secret') || false;
    const isSafari = interaction.options.getBoolean('safari') || false;

    try {
      const trainer = await TeamMember.findByIgn(trainerIgn);
      if (!trainer) {
        await interaction.editReply({ content: `Trainer "${trainerIgn}" not found` });
        return;
      }

      const shiny = await TeamShiny.create({
        national_number: nationalNumber,
        pokemon: pokemon.toLowerCase(),
        original_trainer: trainer.id,
        catch_date: new Date().toISOString().split('T')[0],
        total_encounters: encounters,
        species_encounters: encounters,
        encounter_type: encounterType,
        is_secret: isSecret,
        is_safari: isSafari
      });

      const embed = new EmbedBuilder()
        .setColor(isSecret ? 0xFFD700 : 0x4CAF50)
        .setTitle(`${isSecret ? 'Secret ' : ''}Shiny Added!`)
        .addFields(
          { name: 'Trainer', value: trainerIgn, inline: true },
          { name: 'Pokemon', value: `${pokemon} (#${nationalNumber})`, inline: true },
          { name: 'Encounter Type', value: encounterType, inline: true },
          { name: 'Encounters', value: encounters.toString(), inline: true },
          { name: 'Special', value: isSecret ? 'Secret' : (isSafari ? 'Safari' : 'None'), inline: true }
        )
        .setFooter({ text: `Shiny ID: ${shiny.id}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `Error: ${error.message}` });
    }
  }

  async handleEditShiny(interaction) {
    await interaction.deferReply();

    const shinyId = interaction.options.getInteger('shiny_id');
    const pokemon = interaction.options.getString('pokemon');
    const nationalNumber = interaction.options.getInteger('pokedex_number');
    const encounterType = interaction.options.getString('encounter_type');
    const encounters = interaction.options.getInteger('encounters');
    const isSecret = interaction.options.getBoolean('secret');
    const isSafari = interaction.options.getBoolean('safari');

    try {
      const updates = {};
      if (pokemon) updates.pokemon = pokemon.toLowerCase();
      if (nationalNumber) updates.national_number = nationalNumber;
      if (encounterType) updates.encounter_type = encounterType;
      if (encounters !== null) updates.total_encounters = encounters;
      if (isSecret !== null) updates.is_secret = isSecret;
      if (isSafari !== null) updates.is_safari = isSafari;

      if (Object.keys(updates).length === 0) {
        await interaction.editReply({ content: 'No updates provided' });
        return;
      }

      const shiny = await TeamShiny.update(shinyId, updates);
      if (!shiny) {
        await interaction.editReply({ content: `Shiny with ID ${shinyId} not found` });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x2196F3)
        .setTitle('Shiny Updated Successfully')
        .addFields(
          { name: 'Pokemon', value: `${shiny.pokemon} (#${shiny.national_number})`, inline: true },
          { name: 'Encounter Type', value: shiny.encounter_type, inline: true },
          { name: 'Encounters', value: shiny.total_encounters?.toString() || '0', inline: true }
        )
        .setFooter({ text: `Shiny ID: ${shiny.id}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `Error: ${error.message}` });
    }
  }

  async handleDeleteShiny(interaction) {
    await interaction.deferReply();

    const shinyId = interaction.options.getInteger('shiny_id');

    try {
      const shiny = await TeamShiny.delete(shinyId);
      if (!shiny) {
        await interaction.editReply({ content: `Shiny with ID ${shinyId} not found` });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xFF5722)
        .setTitle('Shiny Deleted Successfully')
        .setDescription(`${shiny.pokemon} (#${shiny.national_number}) has been removed`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `Error: ${error.message}` });
    }
  }

  async handleGetMember(interaction) {
    await interaction.deferReply();

    const ign = interaction.options.getString('ign');

    try {
      const member = await TeamMember.findByIgn(ign);
      if (!member) {
        await interaction.editReply({ content: `Member "${ign}" not found` });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x2196F3)
        .setTitle(member.ign)
        .addFields(
          { name: 'Rank', value: member.rank, inline: true },
          { name: 'Join Date', value: new Date(member.join_date).toLocaleDateString(), inline: true },
          { name: 'Shinies', value: member.shiny_count.toString(), inline: true }
        )
        .setFooter({ text: `Member ID: ${member.id}` })
        .setTimestamp();

      if (member.discord_id) {
        embed.addFields({ name: 'Discord', value: `<@${member.discord_id}>`, inline: true });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `Error: ${error.message}` });
    }
  }

  async handleGetShiny(interaction) {
    await interaction.deferReply();

    const shinyId = interaction.options.getInteger('id');

    try {
      const shiny = await TeamShiny.findById(shinyId);
      if (!shiny) {
        await interaction.editReply({ content: `Shiny with ID ${shinyId} not found` });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(shiny.is_secret ? 0xFFD700 : 0x4CAF50)
        .setTitle(`${shiny.pokemon} (#${shiny.national_number})`)
        .addFields(
          { name: 'Trainer', value: shiny.trainer_name, inline: true },
          { name: 'Catch Date', value: new Date(shiny.catch_date).toLocaleDateString(), inline: true },
          { name: 'Encounter Type', value: shiny.encounter_type || 'N/A', inline: true },
          { name: 'Encounters', value: shiny.total_encounters?.toString() || 'N/A', inline: true },
          { name: 'Secret', value: shiny.is_secret ? 'Yes' : 'No', inline: true },
          { name: 'Safari', value: shiny.is_safari ? 'Yes' : 'No', inline: true }
        )
        .setFooter({ text: `Shiny ID: ${shiny.id}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `Error: ${error.message}` });
    }
  }

  async handleGetShinies(interaction) {
    await interaction.deferReply();

    const trainerIgn = interaction.options.getString('trainer');
    const limit = interaction.options.getInteger('limit') || 10;

    try {
      const filters = { limit };

      if (trainerIgn) {
        const trainer = await TeamMember.findByIgn(trainerIgn);
        if (!trainer) {
          await interaction.editReply({ content: `Trainer "${trainerIgn}" not found` });
          return;
        }
        filters.trainer_id = trainer.id;
      }

      const shinies = await TeamShiny.findAll(filters);

      if (shinies.length === 0) {
        await interaction.editReply({ content: 'No shinies found' });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`Recent Shinies ${trainerIgn ? `by ${trainerIgn}` : ''}`)
        .setDescription(
          shinies.slice(0, limit).map((shiny, idx) => {
            const special = shiny.is_secret ? ' (Secret)' : (shiny.is_safari ? ' (Safari)' : '');
            return `${idx + 1}. **${shiny.pokemon_name}** by ${shiny.trainer_name}${special} - ID: ${shiny.id}`;
          }).join('\n')
        )
        .setFooter({ text: `Showing ${Math.min(shinies.length, limit)} shinies` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `Error: ${error.message}` });
    }
  }

  async handleLeaderboard(interaction) {
    await interaction.deferReply();

    const limit = interaction.options.getInteger('limit') || 10;

    try {
      const leaderboard = await TeamShiny.getTopTrainers(limit);

      if (leaderboard.length === 0) {
        await interaction.editReply({ content: 'No data available for leaderboard' });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('Shiny Leaderboard')
        .setDescription(
          leaderboard.map((trainer, index) => {
            const secret = trainer.secret_count > 0 ? ` (${trainer.secret_count} secret)` : '';
            return `${index + 1}. **${trainer.ign}** - ${trainer.shiny_count} shinies${secret}`;
          }).join('\n')
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `Error: ${error.message}` });
    }
  }

  async handleStats(interaction) {
    await interaction.deferReply();

    try {
      const [stats, members] = await Promise.all([
        TeamShiny.getStats(),
        TeamMember.findAll()
      ]);

      const totalShinies = stats.reduce((sum, stat) => sum + parseInt(stat.count_by_type || 0), 0);
      const secretShinies = stats.reduce((sum, stat) => sum + parseInt(stat.secret_shinies || 0), 0);

      const embed = new EmbedBuilder()
        .setColor(0x9C27B0)
        .setTitle('Team Soju Statistics')
        .addFields(
          { name: 'Total Members', value: members.length.toString(), inline: true },
          { name: 'Total Shinies', value: totalShinies.toString(), inline: true },
          { name: 'Secret Shinies', value: secretShinies.toString(), inline: true }
        )
        .setTimestamp();

      if (stats.length > 0) {
        const encounterTypes = stats
          .filter(stat => stat.encounter_type)
          .slice(0, 5)
          .map(stat => `${stat.encounter_type}: ${stat.count_by_type}`)
          .join('\n');
        if (encounterTypes) {
          embed.addFields({ name: 'Top Encounter Types', value: encounterTypes });
        }
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `Error: ${error.message}` });
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