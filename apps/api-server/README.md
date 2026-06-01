# Team Soju API Server

Backend API for Team Soju website data, auth, Feebas tools, catch events, and shiny screenshot OCR.

The API currently has two runtimes:

- **Cloudflare Worker** in `src/cloudflare/`: the migration target for most API traffic. It supports Postgres or D1 through the Cloudflare repository layer, plus Feebas live updates through a Durable Object.
- **Legacy Express server** in `src/express/` plus `src/server.js`: the original Node/Postgres API. It still owns screenshot OCR/sprite endpoints and remains useful for local Node development and migration fallback.

---

## Quick Start

### Prerequisites

- Node.js
- PostgreSQL for the Express server and Worker Postgres backend
- Wrangler for Cloudflare Worker development/deploys
- Discord OAuth credentials for web auth

### Install

```bash
cd apps/api-server
npm install
```

Create the repo-root `.env` from the example and fill in database, auth, Discord, and Cloudflare values.

```bash
cp ../../.env.example ../../.env
```

### Express Development

```bash
createdb -U postgres team_soju
npm run migrate
npm run seed
npm run dev
```

Default Express port is `3001`.

### Worker Development

```bash
npm run dev:worker
```

The Worker dev script runs:

```bash
wrangler dev --local --config wrangler.jsonc --env-file ../../.env
```

Default Worker port is assigned by Wrangler, commonly `8787`.

---

## Runtime Ownership

### Cloudflare Worker

The Worker directly handles:

- Health and dev bot-token generation
- Auth: register, login, logout, current user, email verification, password reset, email/password changes, Discord OAuth
- Members CRUD
- Shinies CRUD and aggregate views
- Catch event management, submissions, collaborators, OCR, screenshots
- Feebas board REST, leaderboard, reset, tile updates, and WebSocket stream

The Worker proxies legacy-only endpoints when `LEGACY_API_BASE_URL` is configured:

- `POST /api/shinies/from-screenshot`
- `POST /api/shinies/from-screenshot/async`
- `GET /api/shinies/sprites/:nationalNumber/greyscale`
- `GET /api/shinies/sprites/:nationalNumber/greyscale.gif`
- Any `/api/auth/*` path not implemented by the Worker

### Express Server

The Express server handles the same legacy members, shinies, auth, and Feebas routes for Node deployments. It also owns the screenshot OCR and greyscale sprite routes.

---

## API Endpoints

### System

- `GET /health` - Runtime health check
- `GET /generate-bot-token` - Generate a development bot JWT; disabled in production

### Auth

- `POST /api/auth/register` - Create an email/password account and send email verification
- `POST /api/auth/login` - Sign in with email/password
- `POST /api/auth/logout` - Clear the session cookie
- `GET /api/auth/me` - Return the current signed-in user, or `null`
- `POST /api/auth/forgot-password` - Request a password reset email
- `POST /api/auth/reset-password` - Reset password with a reset token
- `POST /api/auth/change-email` - Change the signed-in user's email and send verification
- `POST /api/auth/change-password` - Change or add a password for the signed-in user
- `GET /api/auth/verify-email` - Verify an email token
- `GET /api/auth/discord` - Start Discord OAuth
- `GET /api/auth/discord/callback` - Discord OAuth callback
- `POST /api/auth/discord/session` - Exchange a Discord OAuth handoff token for a browser session

### Members

- `GET /api/members` - List active team members
- `GET /api/members/:id` - Get member by ID
- `GET /api/members/:id/stats` - Get a member's shiny stats
- `GET /api/members/ign/:ign` - Get active member by IGN
- `GET /api/members/ign/inactive/:ign` - Get inactive or active member by IGN
- `GET /api/members/discord/:discordId` - Get member by Discord ID
- `POST /api/members` - Create a member; bot token required
- `PUT /api/members/:id` - Update a member; bot token required
- `DELETE /api/members/:id` - Deactivate a member; bot token required
- `PUT /api/members/reactivate/:id` - Reactivate a member; bot token required

### Shinies

- `GET /api/shinies` - List shinies with filters
- `GET /api/shinies/:id` - Get shiny by ID
- `GET /api/shinies/stats` - Get team shiny stats
- `GET /api/shinies/leaderboard` - Get top trainers
- `POST /api/shinies` - Create a shiny; bot token required
- `PUT /api/shinies/:id` - Update a shiny; bot token required
- `DELETE /api/shinies/:id` - Delete a shiny; bot token required

Shiny list query parameters:

- `active`
- `trainer_id`
- `pokemon_name`
- `encounter_type`
- `is_secret`
- `is_alpha`
- `catch_date_after`
- `catch_date_before`
- `sort_by`
- `sort_order`
- `secondary_sort_by`
- `secondary_sort_order`
- `limit`

### Screenshot OCR and Sprites

These are legacy Express-owned endpoints. The Worker proxies them when `LEGACY_API_BASE_URL` is set.

- `POST /api/shinies/from-screenshot` - Parse shiny details from screenshot data; bot token required
- `POST /api/shinies/from-screenshot/async` - Parse screenshots asynchronously; bot token required
- `GET /api/shinies/sprites/:nationalNumber/greyscale` - Generate a greyscale Pokemon sprite
- `GET /api/shinies/sprites/:nationalNumber/greyscale.gif` - Generate a greyscale Pokemon GIF sprite

### Catch Events

Worker-owned.

- `GET /api/catch-events` - List catch events
- `POST /api/catch-events` - Create a catch event; user session required
- `GET /api/catch-events/:id` - Get a catch event
- `PUT /api/catch-events/:id` - Update a catch event; owner required
- `DELETE /api/catch-events/:id` - Delete a catch event; owner required
- `GET /api/catch-events/:id/collaborators` - List shared admins; manager required
- `POST /api/catch-events/:id/collaborators` - Add shared admin; owner required
- `DELETE /api/catch-events/:id/collaborators/:userId` - Remove shared admin; owner required
- `POST /api/catch-events/ocr` - Extract catch fields from screenshots
- `GET /api/catch-events/screenshots/:screenshotId` - Fetch stored submission screenshot
- `POST /api/catch-events/:id/publish` - Publish or hide leaderboard; manager required
- `POST /api/catch-events/:id/submissions-closed` - Open or close submissions; manager required
- `POST /api/catch-events/:id/auto-check` - Enable or disable auto-check; manager required
- `POST /api/catch-events/:id/submissions` - Submit or replace an event catch
- `PUT /api/catch-events/:id/submissions/:submissionId` - Edit submission; manager required
- `POST /api/catch-events/:id/submissions/:submissionId/status` - Update submission status; manager required

Catch event list query parameters:

- `owner=me` - List events manageable by the signed-in user
- `published=true` - List published events only

### Feebas

- `GET /api/feebas/:location` - Get Feebas board
- `GET /api/feebas/:location/leaderboard` - Get Feebas leaderboard
- `GET /api/feebas/:location/stream` - WebSocket stream for live board updates
- `POST /api/feebas/:location/tiles/:tileId` - Update a tile
- `POST /api/feebas/:location/reset` - Reset board; disabled in production

Feebas query parameters:

- `actorFingerprint` - Personalizes board view for the current browser/client
- `limit` - Leaderboard limit
- `sortBy` - Leaderboard sort key
- `sortDirection` - `asc` or `desc`

---

## Authentication

The API supports browser sessions and bot-scoped bearer tokens.

Browser sessions are signed JWT cookies. Required environment variables:

```env
JWT_SECRET=your-session-signing-secret
WEB_APP_URL=http://localhost:4321
API_ORIGIN=http://localhost:8787
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_REDIRECT_URI=http://localhost:8787/api/auth/discord/callback
```

Discord bot mutations use bot JWTs:

```bash
curl http://localhost:8787/generate-bot-token
```

Set the result in the root `.env` when needed:

```env
BOT_API_TOKEN=your-bot-token
```

### Cookie Configuration

For preview/staging deployments that need cookies shared across subdomains:

```env
AUTH_COOKIE_DOMAIN=.teamsoju.com
AUTH_COOKIE_SAMESITE=None
AUTH_COOKIE_SECURE=true
```

Browsers only accept a `Domain` attribute that is a parent of the response host.
When no cookie domain is set, secure `SameSite=None` cookies are automatically marked `Partitioned` so Chrome can persist cross-site API sessions under the Team Soju site.

---

## Data and Storage

### Postgres

- Express uses Postgres through `src/config/connection.js`.
- Express schema lives at `src/express/models/schema.sql`.
- `npm run migrate` applies the Express/Postgres schema.

### Cloudflare D1

- Worker D1 schema lives at `src/cloudflare/schema.d1.sql`.
- Set `DB_BACKEND=d1` and bind `DB` to use D1.
- Default Worker backend is Postgres through `DATABASE_URL`.

Postgres-to-D1 helpers:

- `src/scripts/postgresToD1.js`
- `src/scripts/export-postgres-to-d1.js`

Example staging export/import:

```bash
npm run export:d1 -- --wipe --out /tmp/team-soju-staging-import.sql
npx wrangler d1 execute team-soju-staging --remote --file=/tmp/team-soju-staging-import.sql
```

---

## Project Structure

```text
apps/api-server/
├── src/
│   ├── cloudflare/
│   │   ├── contracts/       # Worker API validation and payload contracts
│   │   ├── models/          # Worker domain rules, not persistence
│   │   ├── repositories/    # Worker Postgres/D1 data access
│   │   ├── routes/          # Worker route groups
│   │   ├── services/        # Worker shared services/helpers
│   │   ├── schema.d1.sql
│   │   ├── worker.js
│   │   └── worker-entry.mjs
│   ├── config/              # Express Postgres connection, migrations, seeds
│   ├── express/
│   │   ├── models/          # Legacy Express/Postgres models and schema.sql
│   │   └── routes/          # Legacy Express route handlers
│   ├── middleware/          # Express middleware
│   ├── scripts/             # Data export/import helpers
│   ├── services/            # Express services
│   ├── utils/               # Shared API utilities
│   └── server.js            # Express app entry
├── test/
├── wrangler.jsonc
├── package.json
└── README.md
```

---

## Development Notes

- Keep components under 600 lines when practical. Some legacy Express and repository files still exceed this and should be split when touched.
- Prefer adding Worker code under `src/cloudflare/routes`, `src/cloudflare/services`, `src/cloudflare/repositories`, `src/cloudflare/contracts`, or `src/cloudflare/models` based on responsibility.
- Add Express-only changes under `src/express`.
- When adding schema changes, update the appropriate schema:
  - Express/Postgres: `src/express/models/schema.sql`
  - Worker/D1: `src/cloudflare/schema.d1.sql`

### Testing

Run all backend tests from the monorepo root:

```bash
npm run test:api
```

Run API-server tests directly:

```bash
cd apps/api-server
npm test
```

Focused examples:

```bash
npm test -- --runTestsByPath test/cloudflare.worker.test.js
npm test -- --runTestsByPath test/auth.routes.test.js
```

---

## Deployment

### Express

1. Configure Postgres and environment variables.
2. Run migrations with `npm run migrate`.
3. Start with `npm start` or a process manager.

### Cloudflare Worker

```bash
npm run deploy:cf
npm run deploy:cf:staging
```

Useful Worker commands:

```bash
npm run deploy:cf:preview
npm run tail:cf:staging
```
