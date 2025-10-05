# Team Soju Backend API

A Node.js backend API with PostgreSQL database for managing Team Soju members and shiny Pokemon data, with Discord bot integration.

## Features

- **Team Member Management**: Add, update, delete, and retrieve team member information
- **Shiny Pokemon Tracking**: Comprehensive shiny Pokemon database with detailed stats
- **Discord Bot Integration**: Slash commands for easy data management through Discord
- **RESTful API**: Clean API endpoints for frontend integration
- **Data Validation**: Input validation using Joi
- **Database Migrations**: Automated database setup and seeding

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Discord Bot Token (for bot functionality)

### Installation

1. **Clone and setup**:
   ```bash
   cd server
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.example .env
   # Edit .env with your database and Discord credentials
   ```

3. **Database Setup**:
   ```bash
   # Create your PostgreSQL database first
   createdb -U postgres team_soju

   # Run migrations
   npm run migrate

   # Seed with initial data (optional)
   npm run seed
   ```

4. **Start the server**:
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## API Endpoints

### Team Members

- `GET /api/members` - Get all team members
- `GET /api/members/:id` - Get member by ID
- `GET /api/members/ign/:ign` - Get member by IGN
- `GET /api/members/discord/:discordId` - Get member by Discord ID
- `POST /api/members` - Create new member
- `PUT /api/members/:id` - Update member
- `DELETE /api/members/:id` - Deactivate member
- `GET /api/members/:id/stats` - Get member's shiny statistics

### Team Shinies

- `GET /api/shinies` - Get all shinies (with filters)
- `GET /api/shinies/:id` - Get shiny by ID
- `POST /api/shinies` - Add new shiny
- `PUT /api/shinies/:id` - Update shiny
- `DELETE /api/shinies/:id` - Delete shiny
- `GET /api/shinies/stats` - Get team shiny statistics
- `GET /api/shinies/leaderboard` - Get top trainers

### Query Parameters for Shinies

- `trainer_id` - Filter by trainer UUID
- `pokemon_name` - Filter by Pokemon name
- `encounter_type` - Filter by encounter type
- `is_secret` - Filter secret shinies (true/false)
- `is_safari` - Filter safari shinies (true/false)
- `limit` - Limit number of results

## Discord Bot Commands

The bot provides these slash commands:

- `/addmember <ign> [discord] [rank]` - Add a new team member
- `/addshiny <trainer> <pokemon> <encounter_type> [encounters] [secret]` - Add a shiny catch
- `/member <ign>` - Get member information
- `/shinies [trainer] [limit]` - List recent shinies
- `/leaderboard [limit]` - Show shiny leaderboard
- `/stats` - Show team statistics

### Starting the Discord Bot

```bash
# Make sure your .env has DISCORD_TOKEN and other Discord settings
node src/discord/bot.js
```

## Database Schema

### Team Members
- Basic member info (IGN, Discord ID, rank, join date)
- Activity status tracking
- Relationship to shinies

### Team Shinies
- Complete Pokemon data (Pokedex number, trainer, catch date)
- Encounter details (type, location, encounters)
- Pokemon stats (IVs, nature, level)
- Special flags (secret, safari)
- Screenshots and notes

### Pokemon Species
- Reference table for Pokemon data
- Pokedex numbers, names, types, generation

## Authentication

The API uses JWT tokens for Discord bot authentication. Generate a token for development:

```bash
# Visit http://localhost:3001/generate-bot-token (development only)
curl http://localhost:3001/generate-bot-token
```

## Example Usage

### Adding a Team Member via API

```bash
curl -X POST http://localhost:3001/api/members \
  -H "Content-Type: application/json" \
  -d '{
    "ign": "TrainerName",
    "discord_id": "123456789012345678",
    "rank": "Member"
  }'
```

### Adding a Shiny via API

```bash
curl -X POST http://localhost:3001/api/shinies \
  -H "Content-Type: application/json" \
  -d '{
    "national_number": 25,
    "pokemon": "pikachu",
    "original_trainer": "uuid-of-trainer",
    "catch_date": "2024-01-15",
    "total_encounters": 1247,
    "species_encounters": 1247,
    "encounter_type": "single",
    "location": "Route 1",
    "nature": "Adamant",
    "iv_hp": 31,
    "iv_attack": 31,
    "iv_defense": 25,
    "iv_sp_attack": 12,
    "iv_sp_defense": 28,
    "iv_speed": 31,
    "is_secret": false
  }'
```

## Development

### Project Structure

```
backend/
├── src/
│   ├── config/           # Database connection, migrations, seeds
│   ├── models/           # Data models (TeamMember, TeamShiny)
│   │   └── schema.sql    # Database schema
│   ├── routes/           # API route handlers
│   ├── middleware/       # Authentication and other middleware
│   ├── discord/          # Discord bot implementation
│   └── server.js         # Main server file
├── package.json
└── README.md
```

### Adding New Features

1. **Database Changes**: Update `schema.sql` and run migrations
2. **API Endpoints**: Add routes in the appropriate route file
3. **Discord Commands**: Add commands in `discord/bot.js`
4. **Models**: Update model files for new database operations

## Deployment

For production deployment:

1. Set up PostgreSQL database
2. Configure environment variables
3. Run migrations: `npm run migrate`
4. Start with PM2 or similar: `pm2 start src/server.js`
5. Set up reverse proxy (nginx) if needed

## Contributing

1. Follow the existing code structure
2. Add proper error handling
3. Validate all inputs
4. Test API endpoints
5. Update documentation

## Support

For issues or questions about the Team Soju backend, please contact the development team or create an issue in the repository.