# Team Soju Backend API

A Node.js backend API with PostgreSQL database for managing Team Soju members and shiny Pokemon data, with Discord bot integration.

This app now also includes a Cloudflare Worker runtime under [src/cloudflare/worker.js](/root/repos/team-soju-website/apps/api-server/src/cloudflare/worker.js) so the CRUD API can move to Workers first while screenshot/OCR and non-`/me` auth flows remain on the legacy Node server during migration. Feebas live updates are served from the Worker with a hibernating Durable Object WebSocket.

---

## Features

- **Team Member Management**: Add, update, delete, and retrieve team member information
- **Shiny Pokemon Tracking**: Comprehensive shiny Pokemon database with detailed stats
- **Discord Bot Integration**: Slash commands for easy data management through Discord
- **RESTful API**: Clean API endpoints for frontend integration
- **Data Validation**: Input validation using Joi
- **Database Migrations**: Automated database setup and seeding

---

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
   # Run at project root
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

---

## API Endpoints

### Team Members

- `GET /api/members` - Get all team members
- `GET /api/members/:id` - Get member by ID
- `GET /api/members/ign/:ign` - Get member by IGN
- `GET /api/members/ign/inactive/:ign` - Get member by IGN (including inactive members)
- `GET /api/members/discord/:discordId` - Get member by Discord ID
- `POST /api/members` - Create new member
- `PUT /api/members/:id` - Update member
- `DELETE /api/members/:id` - Deactivate member
- `PUT /api/members/reactivate/:id` - Reactivate member
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
- `is_alpha` - Filter alpha shinies (true/false)
- `catch_date_after` - Filter shinies caught after a date (YYYY-MM-DD)
- `catch_date_before` - Filter shinies caught before a date (YYYY-MM-DD)
- `sort_by` - Sort by `catch_date` or `total_encounters`
- `sort_order` - Ascending or descending sort order
- `limit` - Limit number of results

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

The API supports two authentication paths:

- Web users can create accounts with email, password, and IGN.
- Web users can sign in or register with Discord OAuth2.
- Discord bot mutations still use bot-scoped JWT bearer tokens.

### Web User Endpoints

- `POST /api/auth/register` - Create an email/password account and set the session cookie
- `POST /api/auth/login` - Sign in with email/password
- `POST /api/auth/logout` - Clear the session cookie
- `GET /api/auth/me` - Return the current signed-in user, or `null`
- `GET /api/auth/discord` - Start Discord OAuth2
- `GET /api/auth/discord/callback` - Discord OAuth2 callback

Required environment variables:

```env
JWT_SECRET=your-session-signing-secret
WEB_APP_URL=http://localhost:4321
API_ORIGIN=http://localhost:3001
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_REDIRECT_URI=http://localhost:3001/api/auth/discord/callback
```

In the Discord Developer Portal, add the exact redirect URI above for local development and the production callback URL for deployed environments.

### Bot Tokens

Generate a bot token for development:

```bash
# Visit http://localhost:3001/generate-bot-token (development only)
curl http://localhost:3001/generate-bot-token
```

Add this token to the root `.env` file:
```env
BOT_API_TOKEN=your-bot-token
```

---

## Example Usage

### Adding a Team Member via API

```bash
curl -X POST http://localhost:3001/api/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BOT_API_TOKEN" \
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
  -H "Authorization: Bearer $BOT_API_TOKEN" \
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
    "is_alpha": false
  }'
```

---

## Development

### Testing

- All backend Jest tests live under `test/`.
- Run the full backend test suite (with coverage) from the monorepo root `team-soju-website/`:

  ```bash
  npm run test:api
  ```

- Route tests use `supertest` against the Express app and mock the database layer.
- Model and config script tests mock the PostgreSQL pool and filesystem/`path` as needed.

### Cloudflare Worker Runtime

- Worker entrypoint: `src/cloudflare/worker.js`
- Worker config: `wrangler.jsonc`
- Start local Worker dev server:

  ```bash
  npm run dev:worker
  ```

- Default Worker database backend is Postgres via `DATABASE_URL`.
- Set `DB_BACKEND=d1` and bind `DB` to switch the Worker to D1. The D1 schema covers team members, shinies, app users for `GET /api/auth/me`, and Feebas board REST tables.
- Set `LEGACY_API_BASE_URL` during migration to proxy legacy-only runtime routes:
  - `POST /api/shinies/from-screenshot`
  - `POST /api/shinies/from-screenshot/async`
  - `GET /api/shinies/sprites/:nationalNumber/greyscale(.gif)`
- To keep screenshot OCR on the legacy Node/Render runtime while using Worker/D1 data, set `SCREENSHOT_DATA_API_BASE_URL` on the Node service to the Worker API base URL, for example `https://team-soju-api.tunacore.workers.dev/api`.
- If the Node service and Worker do not share `JWT_SECRET`, also set `SCREENSHOT_DATA_API_BOT_TOKEN` on the Node service to a bot token accepted by the Worker.

### D1 Compatibility

- D1 schema lives in `src/models/schema.d1.sql`.
- Postgres export helpers live in `src/scripts/postgresToD1.js` and `src/scripts/export-postgres-to-d1.js`; they support members, shinies, app users, and Feebas board history.
- The Worker repository layer supports both Postgres and D1 so the HTTP contract stays unchanged while the storage backend changes.
- To replace staging D1 with current Postgres data:

  ```bash
  cd apps/api-server
  npm run export:d1 -- --wipe --out /tmp/team-soju-staging-import.sql
  npx wrangler d1 execute team-soju-staging --remote --file=/tmp/team-soju-staging-import.sql
  ```

  `--wipe` only writes DELETE statements into the generated SQL file; staging is changed when the file is executed with Wrangler.

### Project Structure

```
backend/
├── src/
│   ├── config/           # Database connection, migrations, seeds
│   ├── models/           # Data models (TeamMember, TeamShiny)
│   │   └── schema.sql    # Database schema
│   ├── routes/           # API route handlers
│   ├── middleware/       # Authentication and other middleware
│   └── server.js         # Main server file
├── test/                 # Backend Jest tests
├── package.json
└── README.md
```

### Adding New Features

1. **Database Changes**: Update `schema.sql` and run migrations
2. **API Endpoints**: Add routes in the appropriate route file
3. **Discord Commands**: Add commands in `discord/bot.js`
4. **Models**: Update model files for new database operations

---

## Deployment

For production deployment:

1. Set up PostgreSQL database
2. Configure environment variables
3. Run migrations: `npm run migrate`
4. Start with PM2 or similar: `pm2 start src/server.js`
5. Set up reverse proxy (nginx) if needed

---

## Contributing

1. Follow the existing code structure
2. Add proper error handling
3. Validate all inputs
4. Test API endpoints
5. Update documentation

---

## Support

For issues or questions about the Team Soju backend, please contact the development team or create an issue in the repository.
