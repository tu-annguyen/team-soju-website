/**
 * Team Soju Discord Bot
 * Main application entry point
 */

const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
}

console.log("🚀 Discord bot process starting...");

// Optional: helpful to see clean exits
process.on("exit", (code) => {
  console.log("👋 process exit with code:", code);
});

const { COMMANDS } = require('./commands');
const {
  registerSlashCommands,
  getCommandHandler,
  validateEnvironment,
  checkCommandPermission,
  getCommandRequiredRoles,
} = require('./utils');

class TeamSojuBot {
  constructor() {
    validateEnvironment(['DISCORD_TOKEN', 'DISCORD_CLIENT_ID']);
    this.loggedIn = false;

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
      this.loggedIn = true;

      console.log(`🤖 Discord bot logged in as ${this.client.user.tag}!`);

      if (process.env.REGISTER_COMMANDS_ON_START === 'true') {
        this.registerCommands();
      } else {
        console.log('ℹ️ Skipping command registration (REGISTER_COMMANDS_ON_START not true)');
      }
    });

    if (process.env.DISCORD_DEBUG === 'true') {
      this.client.on('debug', (m) => console.log('[discord:debug]', m));
    }

    // Shard events can provide insight into connectivity issues
    this.client.on('shardReady', (id) => console.log('shardReady', id));
    this.client.on('shardDisconnect', (e, id) => console.log('shardDisconnect', id, e));
    this.client.on('shardError', (e, id) => console.log('shardError', id, e));
    this.client.on('shardReconnecting', (id) => console.log('shardReconnecting', id));

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
    console.log("🔑 Attempting Discord login. Token present?", !!process.env.DISCORD_TOKEN);

    this.client.login(process.env.DISCORD_TOKEN).catch((err) => {
      console.error("❌ Discord login failed:", err);
      process.exit(1);
    });

    const watchdogEnabled = process.env.LOGIN_WATCHDOG_ENABLED === 'true';
    const deadline = Number(process.env.LOGIN_DEADLINE_MS || 180_000);

    if (watchdogEnabled) {
      setTimeout(() => {
        const isReady = this.client.isReady?.() || !!this.client.readyAt || this.loggedIn;

        if (!isReady) {
          console.error(`⏱️ Login did not reach ready() within ${Math.round(deadline / 1000)}s.`);
          console.error('Debug state:', {
            loggedInFlag: this.loggedIn,
            readyAt: this.client.readyAt,
            wsStatus: this.client.ws?.status,
          });
          process.exit(1); // Render restarts worker
        }
      }, deadline);
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
      await bot.client.destroy();
    } catch (e) {
      console.error('Error during shutdown:', e);
    } finally {
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (err) => {
    console.error('Unhandled promise rejection:', err);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    shutdown('uncaughtException');
  });
}