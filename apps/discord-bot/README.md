# Team Soju Discord Bot

A Discord bot application for managing Team Soju members and tracking shiny Pokemon catches. It now runs on Discord HTTP interactions so it can be deployed as a Cloudflare Worker instead of a long-lived Gateway process.

## Features

- **Member Management**: Add, edit, delete, and view team members
- **Shiny Tracking**: Record and manage shiny Pokemon catches
- **Statistics**: View team statistics and leaderboards

## Architecture

This app uses the following structure:

```
src/
├── app.js              # Local dev server entry point
├── worker.js           # HTTP interaction handler
├── worker.mjs          # Cloudflare Worker module entry
├── commands.js         # Slash command definitions
├── discord/            # Discord API builders + interaction adapter
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
   # Run at project root
   cp .env.example .env
   ```

   Add your Discord credentials:
   ```env
   DISCORD_CLIENT_ID=your-client-id
   DISCORD_PUBLIC_KEY=your-discord-public-key
   DISCORD_TOKEN=your-bot-token # required at runtime for command registration and role-based permission checks
   DISCORD_GUILD_ID=your-guild-id  # Optional: for faster command updates
   ```

3. **Ensure database is running**:
   The bot connects to the same database as the API server. Make sure the database is properly configured with all required tables and migrations applied.

   Generate a JWT Secret at [https://jwtsecrets.com](https://jwtsecrets.com) and add it to `.env`:
   ```env
   JWT_SECRET=your-jwt-secret
   ```

   Start the api server
   ```bash
   # Run at project root
   npm run dev:api
   ```

   Generate a bot token for development by visiting [http://localhost:8787/generate-bot-token](http://localhost:8787/generate-bot-token) and add it to `.env`. If an existing local token returns `Invalid token.`, regenerate it from the API server using the same `JWT_SECRET`.
   ```env
   BOT_API_TOKEN=your-bot-token
   ```

### Running the Bot

**Development** (local Worker endpoint):
```bash
npm run dev
```

By default Wrangler listens on `8787`. From the repo root, `npm run dev` runs the bot Worker on `8788` so it can run alongside the API Worker.

For the old Node interaction server, use `npm run dev:express`.

If Discord needs to reach your local Worker endpoint, run `ngrok` separately against the Worker port you are using.

**Register slash commands**:
```bash
npm run register
```

`npm run deploy:cf` now performs both steps for production: it deploys the Worker to the top-level Wrangler environment with `--env=""` and then re-registers the Discord slash commands so new commands become available.

Production Discord bot deployments use Cloudflare Workers:
```bash
npm run deploy:cf
npm run deploy:cf:staging
```

Point your Discord Interactions Endpoint URL at the deployed Worker URL.

## Cloudflare Worker Notes

- The Worker verifies `x-signature-ed25519` using `DISCORD_PUBLIC_KEY`.
- `DISCORD_TOKEN` is required in production because HTTP interactions only include role IDs; the bot uses the token to resolve guild role names before permission checks.
- Slash commands are executed through stateless HTTP interactions; no Gateway connection or shard lifecycle is used.
- Interactive shiny lists now encode paging and selection in component `custom_id`s so they work without in-memory collectors.
- Screenshot OCR is delegated to the API server via `POST /api/shinies/from-screenshot`, keeping `sharp` and `tesseract.js` out of the Worker runtime.

## Commands

### Shiny Management
Only Soju members can run these commands.

#### `/myshinies`
List shinies for the Discord account linked to your member profile.

**Options:**
- `limit` (optional): Page size (default: 10)

Each page includes a selector for the visible shinies plus `View`, `Edit`, and `Delete` actions. `Edit` opens a modal so mobile users can update a shiny without copying the UUID.

**Example:**
```
/myshinies limit:10
```

#### `/shinies`
List recent shiny catches with interactive pagination.

**Options:**
- `trainer` (optional): Filter by trainer IGN
- `limit` (optional): Page size (default: 10). Use buttons below the response to navigate between pages.

Each page includes a selector for the visible shinies plus `View`, `Edit`, and `Delete` actions. `Edit` opens a modal so mobile users can update a shiny without copying the UUID.
`View` is public. `Edit` and `Delete` require `Soju`, `Elite 4`, or `Champion` role(s). Only `Elite 4` and `Champion` can mutate shinies that are not their own.

**Example:**
```
/shinies trainer:tunacore limit:20
```

#### `/addshiny`
Record a new shiny Pokemon catch.

**Options:**
- `trainer` (required): Trainer's IGN
- `pokemon` (required): Pokemon name
- `pokedex_number` (required): National Pokedex number
- `encounter_type` (required): How it was encountered
- `catch_date` (optional): Date of the catch (YYYY-MM-DD) (default: today)
- `status` (optional): Status of the shiny (`Owned`, `Sold`, `Fled`, `Died`, `Bred`)
- `secret` (optional): Is this a secret shiny?
- `total_encounters` (optional): Total encounters before catch
- `specie_encounters` (optional): Species encounters before catch
- `nature` (optional): Nature of the Pokemon
- `ivs` (optional): Comma-separated IVs in the order: HP, ATK, DEF, SPATK, SPDEF, SPEED 

**Example:**
```
/addshiny trainer:tunacore pokemon:dratini encounter_type:Horde catch_date:2026-01-15 total_encounters:20374 species_encounters:3332 nature:Bold ivs:11,1,15,31,14,4
```

**Notable optional fields:**

#### `/addshinyscreenshot`
Record a new shiny Pokemon catch with an uploaded screenshot.

**Options:**
- `screenshot` (required): Screenshot of the shiny Pokemon's share page
- `encounter_type` (required): How it was encountered
- `secret` (optional): Is this a secret shiny?
- `alpha` (optional): Is this an alpha shiny?

**Date handling:**
- The bot auto-detects screenshot dates when the format is unambiguous, including common forms like `MM/DD/YY`, `DD/MM/YYYY`, and `YYYY-MM-DD`.
- If the screenshot date is ambiguous, such as `03/04/26`, the OCR flow does not guess. It uses the date the command was called instead and adds an `ambiguous date` note before the success embed.

**Example:**
```
/addshinyscreenshot screenshot:image.png encounter_type:Horde secret:False
```

#### `/editshiny` (⚠️Deprecated) 
> Warning: this command is deprecated. Use `/myshinies` to edit your shinies, instead.
Update an existing shiny entry.

**Options:**
- `shiny_id` (required): ID of shiny to edit
- All other options are optional for updating
- `variant` (optional): Pokemon form slug. This must be a valid name from PokeAPI's `pokemon-form` route, such as `deerling-winter` or `basculin-blue-striped`.
- `status` (optional): Dropdown with `Owned`, `Sold`, `Fled`, `Died`, `Bred`

**Example:**
```
/editshiny shiny_id:4f645599-a184-4f17-97f5-a8ccd18f2817 variant:deerling-winter total_encounters:2000 secret:true
```

#### `/failshiny` (⚠️Deprecated)
> Warning: this command is deprecated. Use `/myshinies` to fail your shinies, instead.
Mark a shiny entry with a non-owned status.

**Options:**
- `shiny_id` (required): ID of shiny to edit
- `status` (required): Dropdown with `Sold`, `Fled`, `Died`, `Bred`

**Example:**
```
/failshiny shiny_id:060df408-f200-48b6-addc-f4b8fa98b25a status:Fled
```

#### `/deleteshiny` (⚠️Deprecated)
> Warning: this command is deprecated. Use `/myshinies` to delete your shinies, instead.
Delete a shiny entry.

**Options:**
- `shiny_id` (required): ID of shiny to delete

**Example:**
```
/deleteshiny shiny_id:4f645599-a184-4f17-97f5-a8ccd18f2817
```

#### `/shiny` (⚠️Deprecated)
> Warning: this command is deprecated. Use `/myshinies` to view your shinies, instead.
View details about a specific shiny.

**Options:**
- `id` (required): Shiny ID

**Example:**
```
/shiny id:4f645599-a184-4f17-97f5-a8ccd18f2817
```

### Member Management
Only Champions and Elite 4 can run these commands.

#### `/member`
Display information about a team member.

**Options:**
- `ign` (required): IGN to lookup

**Example:**
```
/member ign:tunacore
```

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

#### `/reactivatemember`
Reactivate a previously removed team member.

**Options:**
- `ign` (required): IGN to reactivate

**Example:**
```
/reactivatemember ign:oldplayer
```

### Statistics
These commands are open to the public.

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
