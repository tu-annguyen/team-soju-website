/**
 * Team Soju Discord Bot
 * Main application entry point
 */

const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const { COMMANDS } = require('./commands');
const {
  registerSlashCommands,
  getCommandHandler,
  validateEnvironment,
  checkCommandPermission,
  getCommandRequiredRoles,
  validateSojuTrainerIGN,
} = require('./utils');

class TeamSojuBot {
  constructor() {
    validateEnvironment(['DISCORD_TOKEN', 'DISCORD_CLIENT_ID']);

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
      ],
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.once('clientReady', () => {
      console.log(`🤖 Discord bot logged in as ${this.client.user.tag}!`);

      if (process.env.REGISTER_COMMANDS_ON_START === 'true') {
        this.registerCommands();
      } else {
        console.log('ℹ️ Skipping command registration (REGISTER_COMMANDS_ON_START not true)');
      }
    });

    this.client.on('warn', console.warn);
    this.client.on('error', console.error);

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      console.log(`Command received: ${interaction.commandName} from ${interaction.user.tag}`);

      try {
        // Check if user has required permissions
        const requiredRoles = getCommandRequiredRoles(interaction.commandName);
        const permissionResult = await checkCommandPermission(interaction, requiredRoles, interaction.commandName);
        
        if (!permissionResult.allowed) {
          const errorMessage = `❌ ${permissionResult.reason}`;
          
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: errorMessage, ephemeral: true });
          } else {
            await interaction.editReply({ content: errorMessage, ephemeral: true });
          }
          return;
        }

        const handler = getCommandHandler(interaction.commandName);
        await handler(interaction);
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

  async registerCommands() {
    try {
      await registerSlashCommands(
        COMMANDS,
        process.env.DISCORD_CLIENT_ID,
        process.env.DISCORD_TOKEN,
        process.env.DISCORD_GUILD_ID
      );
    } catch (error) {
      console.error('Failed to register commands:', error);
    }
  }

  async start() {
    try {
      await this.client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
      console.error('❌ Failed to start Discord bot:', error);
      process.exit(1);
    }
  }
}

module.exports = TeamSojuBot;

// Start bot if run directly
if (require.main === module) {
  const bot = new TeamSojuBot();
  bot.start();
  const shutdown = async (signal) => {
    console.log(`🛑 ${signal} received. Shutting down Discord bot...`);
    try {
      // closes the Discord gateway connection cleanly
      await bot.client.destroy();
    } catch (e) {
      console.error('Error during shutdown:', e);
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM')); // Render sends this on deploy/restart
  process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C locally

  process.on('unhandledRejection', (err) => {
    console.error('Unhandled promise rejection:', err);
  });
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    shutdown('uncaughtException');
  });
}