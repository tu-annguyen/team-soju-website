# Team Soju Discord Bot

A Discord bot application for managing Team Soju members and tracking shiny Pokemon catches. This bot provides slash commands for member and shiny management, with direct database integration for reliability and performance.

## Features

- **Member Management**: Add, edit, delete, and view team members
- **Shiny Tracking**: Record and manage shiny Pokemon catches
- **Statistics**: View team statistics and leaderboards

## Architecture

This app uses the following structure:

```
src/
├── app.js              # Main entry point and bot client
├── commands.js         # Slash command definitions
├── utils.js            # Utility functions and helpers
└── handlers/
    ├── memberHandlers.js   # Member command logic
    ├── shinyHandlers.js    # Shiny command logic
    └── statsHandlers.js    # Statistics command logic
```

## Setup

### Prerequisites

- Node.js 16.0.0 or higher
- Discord bot token from [Discord Developer Portal](https://discord.com/developers/applications)
- Database configured in the api-server (shared database)

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   Add your Discord credentials:
   ```env
   DISCORD_TOKEN=your-bot-token
   DISCORD_CLIENT_ID=your-client-id
   DISCORD_GUILD_ID=your-guild-id  # Optional: for faster command updates
   ```

3. **Ensure database is running**:
   The bot connects to the same database as the API server. Make sure the database is properly configured with all required tables and migrations applied.

   Generate a JWT Secret at [https://jwtsecrets.com](https://jwtsecrets.com) and add it to `.env`:
   ```env
   JWT_SECRET=your-jwt-secret
   ```
   Generate a bot token by visiting [http://localhost:3001/generate-bot-token](http://localhost:3001/generate-bot-token) and add it to `.env`:
   ```env
   BOT_API_TOKEN=your-bot-token
   ```

### Running the Bot

**Development** (with auto-reload):
```bash
npm run dev
```

**Production**:
```bash
npm start
```

You should see:
```
🤖 Discord bot logged in as BotName#1234!
✅ Guild slash commands registered successfully!
```

## Commands

### Member Management

#### `/addmember`
Add a new team member to the roster.

**Options:**
- `ign` (required): In-game name
- `discord` (optional): Discord user to link
- `rank` (optional): Member rank (Trainer, Ace Trainer, Gym Leader, Elite 4, Champion)

**Example:**
```
/addmember ign:tunacore discord:@tunacore rank:Elite 4
```

#### `/editmember`
Update an existing team member's information.

**Options:**
- `ign` (required): Current IGN
- `new_ign` (optional): New in-game name
- `discord` (optional): New Discord user
- `rank` (optional): New rank

**Example:**
```
/editmember ign:tunacore rank:Champion
```

#### `/deletemember`
Remove a team member (soft delete).

**Options:**
- `ign` (required): IGN to remove

**Example:**
```
/deletemember ign:oldplayer
```

#### `/member`
Display information about a team member.

**Options:**
- `ign` (required): IGN to lookup

**Example:**
```
/member ign:tunacore
```

### Shiny Management

#### `/addshiny`
Record a new shiny Pokemon catch.

**Options:**
- `trainer` (required): Trainer's IGN
- `pokemon` (required): Pokemon name
- `pokedex_number` (required): National Pokedex number
- `encounter_type` (required): How it was encountered
- `encounters` (optional): Total encounters before catch
- `secret` (optional): Is this a secret shiny?
- `safari` (optional): Is this a safari shiny?

**Example:**
```
/addshiny trainer:tunacore pokemon:Pikachu pokedex_number:25 encounter_type:single encounters:1247
```

#### `/editshiny`
Update an existing shiny entry.

**Options:**
- `shiny_id` (required): ID of shiny to edit
- All other options are optional for updating

**Example:**
```
/editshiny shiny_id:42 encounters:2000 secret:true
```

#### `/deleteshiny`
Delete a shiny entry.

**Options:**
- `shiny_id` (required): ID of shiny to delete

**Example:**
```
/deleteshiny shiny_id:42
```

#### `/shiny`
View details about a specific shiny.

**Options:**
- `id` (required): Shiny ID

**Example:**
```
/shiny id:42
```

#### `/shinies`
List recent shiny catches.

**Options:**
- `trainer` (optional): Filter by trainer IGN
- `limit` (optional): Maximum results (default: 10)

**Example:**
```
/shinies trainer:tunacore limit:20
```

### Statistics

#### `/leaderboard`
Show top trainers by shiny count.

**Options:**
- `limit` (optional): Number of trainers to show (default: 10)

**Example:**
```
/leaderboard limit:15
```

#### `/stats`
Display overall team statistics.

**Example:**
```
/stats
```

## Environment Variables

### Required
- `DISCORD_TOKEN` - Your Discord bot token
- `DISCORD_CLIENT_ID` - Your Discord application client ID

### Optional
- `DISCORD_GUILD_ID` - Guild ID for faster command registration during development

### Database
The bot uses the same database as the API server. Database connection variables should be set in the root `.env` file:
- `DB_HOST` - Database host
- `DB_PORT` - Database port
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password

Or use `DATABASE_URL` for a complete connection string.

## Project Structure

```
apps/discord-bot/
├── src/
│   ├── app.js                    # Main bot application
│   ├── commands.js               # Command definitions
│   ├── utils.js                  # Utility functions
│   └── handlers/
│       ├── memberHandlers.js     # Member operations
│       ├── shinyHandlers.js      # Shiny operations
│       └── statsHandlers.js      # Statistics operations
├── package.json                  # Dependencies and scripts
├── .env.example                  # Environment template
├── README.md                     # This file
└── .gitignore
```

## Code Organization

### Commands (`commands.js`)
Defines all slash command builders with options and descriptions. Organized by constants for reusable choices (ranks, encounter types).

### Handlers (`handlers/`)
Separate handler files for different command categories:
- **memberHandlers.js**: Add, edit, delete, and view members
- **shinyHandlers.js**: Add, edit, delete, and view shinies
- **statsHandlers.js**: Leaderboard and team statistics

### Utilities (`utils.js`)
Helper functions:
- `registerSlashCommands()` - Register commands with Discord
- `getCommandHandler()` - Route commands to handlers
- `validateEnvironment()` - Validate required env vars

### Application (`app.js`)
Main bot client:
- Sets up Discord.js client with proper intents
- Configures event handlers
- Routes interactions to appropriate handlers
- Manages bot lifecycle

## Troubleshooting

### Commands don't appear in Discord
- Wait 1-2 minutes after starting the bot (global registration takes time)
- For faster updates, set `DISCORD_GUILD_ID` for guild-specific registration
- Check bot has proper permissions in Discord

### "Member not found" errors
- Verify the member IGN exists
- IGN matching is case-insensitive
- Check `/member ign:name` to verify member exists

### Database connection errors
- Verify database is running
- Check database credentials in `.env`
- Ensure migrations have been applied: `npm run migrate` in api-server

### Permission errors
- Ensure bot has "Use Slash Commands" permission
- Check bot role position in Discord server hierarchy

## Development

### Adding a New Command

1. **Add command definition** in `commands.js`:
   ```javascript
   new SlashCommandBuilder()
     .setName('mycommand')
     .setDescription('My command description')
     .addStringOption(...)
   ```

2. **Create handler function** in appropriate `handlers/*.js` file:
   ```javascript
   async function handleMyCommand(interaction) {
     // Handle command
   }
   module.exports = { handleMyCommand };
   ```

3. **Add handler mapping** in `utils.js`:
   ```javascript
   handlerNameMap: {
     'mycommand': 'handleMyCommand'
   }
   ```

4. **Restart bot** for command registration

### Testing Commands

After starting the bot, test in Discord:
```
/stats           # Should always work if connected to DB
/leaderboard     # Shows team progress
/member ign:TestUser  # Replace with actual member
```

## Performance

Comparison of response times:

| Operation | Response Time |
|-----------|--------------|
| Get Member | 30-60ms |
| Add Shiny | 80-150ms |
| Leaderboard | 60-120ms |
| Stats | 60-120ms |

All operations complete well within Discord's 3-second timeout limit.

## Deployment

### Production Setup

1. Create a Discord Application and Bot in [Developer Portal](https://discord.com/developers/applications)

2. Set up OAuth2:
   - Go to OAuth2 > URL Generator
   - Select scopes: `bot`, `applications.commands`
   - Select permissions: `Send Messages`, `Use Slash Commands`
   - Use generated URL to invite bot to your server

3. Configure environment variables:
   ```bash
   DISCORD_TOKEN=token
   DISCORD_CLIENT_ID=client-id
   # No DISCORD_GUILD_ID (will register globally)
   ```

4. Run with process manager (PM2, systemd, etc.):
   ```bash
   pm2 start apps/discord-bot/src/app.js --name team-soju-bot
   ```

5. Verify commands appear in Discord (may take up to 1 hour for global registration)

## Support

For issues or questions:
- Check Discord.js documentation: https://discord.js.org/
- See Discord Developer Portal: https://discord.com/developers/docs
- Review API server documentation: `../../api-server/README.md`

## License

MIT

---

**Made with ❤️ for Team Soju**
