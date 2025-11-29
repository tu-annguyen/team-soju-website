# Team Soju Discord Bot

A Discord bot for managing Team Soju members and their shiny Pokemon catches.

## Features

The bot provides the following slash commands:

### Member Management
- `/addmember` - Add a new team member
- `/editmember` - Edit an existing team member
- `/deletemember` - Remove a team member (soft delete)
- `/member` - View member information

### Shiny Management
- `/addshiny` - Add a new shiny catch
- `/editshiny` - Edit an existing shiny entry
- `/deleteshiny` - Delete a shiny entry
- `/shiny` - View specific shiny information

### Stats & Leaderboards
- `/shinies` - List recent shinies (with optional filters)
- `/leaderboard` - Show shiny leaderboard
- `/stats` - Show team statistics

## Setup

### Prerequisites

1. Node.js (v16 or higher)
2. PostgreSQL database (configured via Supabase or local)
3. Discord Bot Token

### Discord Application Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a New Application
3. Go to the "Bot" section and create a bot
4. Copy the bot token
5. Enable the following Bot Permissions:
   - Read Messages/View Channels
   - Send Messages
   - Use Slash Commands
6. Go to OAuth2 > URL Generator
   - Select scopes: `bot`, `applications.commands`
   - Select permissions: `Send Messages`, `Use Slash Commands`
   - Copy the generated URL and use it to invite the bot to your server

### Environment Variables

Add the following to your `.env` file:

```env
# Discord Configuration
DISCORD_TOKEN=your-discord-bot-token-here
DISCORD_CLIENT_ID=your-discord-client-id-here
DISCORD_GUILD_ID=your-discord-guild-id-here (optional, for guild-specific commands)

# Database Configuration
DATABASE_URL=your-database-url-here
# Or individual connection parameters
DB_HOST=localhost
DB_PORT=5432
DB_NAME=team_soju
DB_USER=username
DB_PASSWORD=password
```

### Installation

1. Install dependencies:
```bash
cd server
npm install
```

2. Set up the database:
```bash
npm run migrate
npm run seed  # Optional: adds sample data
```

3. Start the bot:
```bash
node src/discord/bot.js
```

## Command Usage

### Add Member
```
/addmember ign:TrainerName [discord:@user] [rank:Gym Leader]
```
- `ign` (required): In-game name
- `discord` (optional): Discord user to link
- `rank` (optional): Member rank (Trainer, Ace Trainer, Gym Leader, Elite 4, Champion)

### Edit Member
```
/editmember ign:TrainerName [new_ign:NewName] [discord:@user] [rank:Elite 4]
```
- `ign` (required): Current IGN to edit
- `new_ign` (optional): New in-game name
- `discord` (optional): Discord user to link
- `rank` (optional): New rank

### Delete Member
```
/deletemember ign:TrainerName
```
- Soft deletes the member (sets is_active to false)

### Add Shiny
```
/addshiny trainer:TrainerName pokemon:Pikachu pokedex_number:25 encounter_type:single [encounters:1247] [secret:true] [safari:false]
```
- `trainer` (required): Trainer's IGN
- `pokemon` (required): Pokemon name
- `pokedex_number` (required): National Pokedex number
- `encounter_type` (required): How it was encountered
- `encounters` (optional): Total encounters
- `secret` (optional): Is this a secret shiny?
- `safari` (optional): Is this a safari shiny?

### Edit Shiny
```
/editshiny shiny_id:123 [pokemon:Pikachu] [pokedex_number:25] [encounters:1500]
```
- `shiny_id` (required): ID of the shiny to edit
- Other parameters are optional

### Delete Shiny
```
/deleteshiny shiny_id:123
```

### View Member
```
/member ign:TrainerName
```

### View Shiny
```
/shiny id:123
```

### List Shinies
```
/shinies [trainer:TrainerName] [limit:20]
```
- Shows recent shinies with optional filters

### Leaderboard
```
/leaderboard [limit:15]
```
- Shows top trainers by shiny count

### Stats
```
/stats
```
- Shows overall team statistics

## Architecture

### Direct Database Access

The bot directly accesses the database models instead of using the REST API. This provides:
- Faster response times (no HTTP overhead)
- Better reliability (no network issues)
- Proper transaction handling
- More efficient database queries

### Interaction Handling

The bot properly handles Discord interactions by:
1. Immediately deferring replies for long operations
2. Using `editReply()` to send the final response
3. Proper error handling with user-friendly messages
4. Including relevant IDs in responses for follow-up commands

### Command Registration

Commands are registered either:
- **Guild-specific**: If `DISCORD_GUILD_ID` is set (instant updates, recommended for development)
- **Global**: If no guild ID is set (takes up to 1 hour to update, recommended for production)

## Troubleshooting

### Commands not appearing
- Wait a few minutes after starting the bot
- For guild commands, make sure `DISCORD_GUILD_ID` is set correctly
- Check bot permissions in Discord server settings

### "Application did not respond" errors
- Check database connection
- Verify all required tables exist (run migrations)
- Check bot console logs for errors

### Permission errors
- Ensure bot has proper permissions in Discord server
- Verify bot role is positioned correctly in server hierarchy

## Development

### Testing Commands

1. Start the bot: `node src/discord/bot.js`
2. Use commands in your Discord server
3. Check console logs for debugging information

### Adding New Commands

1. Add command definition in `setupCommands()`
2. Add case in `handleCommand()`
3. Implement handler method following the pattern
4. Restart the bot to register new commands

## Production Deployment

For production:
1. Use global command registration (remove `DISCORD_GUILD_ID`)
2. Use a process manager like PM2:
   ```bash
   pm2 start src/discord/bot.js --name team-soju-bot
   ```
3. Set up proper logging and monitoring
4. Use environment-specific configuration files

## Support

For issues or questions:
- Check the main project README
- Review Discord.js documentation
- Check bot console logs for error details
