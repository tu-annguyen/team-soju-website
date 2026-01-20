/**
 * Team Soju Discord Bot
 * Main application entry point
 */

const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const { COMMANDS } = require('./commands');
const {
  registerSlashCommands,
  getCommandHandler,
  validateEnvironment
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
    this.client.once('ready', () => {
      console.log(`🤖 Discord bot logged in as ${this.client.user.tag}!`);
      this.registerCommands();
    });

    this.client.on('warn', console.warn);
    this.client.on('error', console.error);

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      console.log(`Command received: ${interaction.commandName} from ${interaction.user.tag}`);

      try {
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
}
