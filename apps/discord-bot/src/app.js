/**
 * Team Soju Discord Bot
 * Main application entry point
 */

const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');
const fs = require('fs');
const os = require('os');
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
  validateSojuTrainerIGN,
} = require('./utils');

/**
 * Restart control
 * - If bot isn't ready within LOGIN_DEADLINE_MS, exit(1) to let Render restart the worker
 * - Persist attempt count to a small file so it survives process restarts
 */
const LOGIN_DEADLINE_MS = 60_000;
const MAX_RESTARTS = 3;
const ATTEMPT_FILE = path.join(os.tmpdir(), 'team-soju-bot-login-attempt');

function readAttemptCount() {
  try {
    const raw = fs.readFileSync(ATTEMPT_FILE, 'utf8').trim();
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeAttemptCount(n) {
  try {
    fs.writeFileSync(ATTEMPT_FILE, String(n), 'utf8');
  } catch (e) {
    console.error('Failed to write attempt file:', e);
  }
}

function resetAttemptCount() {
  try {
    fs.unlinkSync(ATTEMPT_FILE);
  } catch {
    // ignore if missing
  }
}

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
    console.log("🔑 Attempting Discord login. Token present?", !!process.env.DISCORD_TOKEN);

    // Kick off login but don't await it here; we’ll watchdog readiness.
    this.client.login(process.env.DISCORD_TOKEN).catch((err) => {
      console.error("❌ Discord login failed:", err);
      // Fail fast on immediate errors (bad token, etc.)
      process.exit(1);
    });

    // Watchdog: if not ready within deadline, exit(1) to let Render restart us.
    setTimeout(() => {
      if (!this.loggedIn) {
        console.error(`⏱️ Login did not reach ready() within ${LOGIN_DEADLINE_MS / 1000}s.`);
        process.exit(1);
      }
    }, LOGIN_DEADLINE_MS);
  }
}

module.exports = TeamSojuBot;

// Start bot if run directly
if (require.main === module) {
  // bump attempt counter
  const attempt = readAttemptCount() + 1;
  writeAttemptCount(attempt);

  console.log(`🔁 Login attempt ${attempt}/${MAX_RESTARTS}`);

  if (attempt > MAX_RESTARTS) {
    console.error(`🛑 Exceeded max restart attempts (${MAX_RESTARTS}). Not restarting anymore.`);
    // Exit 0 so Render won't endlessly churn; you’ll see it “live” but stopped.
    // Alternatively use exit(1) if you prefer to keep it restarting forever.
    process.exit(0);
  }

  const bot = new TeamSojuBot();
  bot.start();

  const shutdown = async (signal) => {
    console.log(`🛑 ${signal} received. Shutting down Discord bot...`);
    try {
      await bot.client.destroy();
    } catch (e) {
      console.error('Error during shutdown:', e);
    } finally {
      process.exit(0);
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