# Team Soju API Worker

The Team Soju backend runs entirely on Cloudflare Workers. Express and the Render service are deprecated and no longer receive production traffic.

## Runtime architecture

- Cloudflare Worker: HTTP API, authentication, Discord bot data, OCR intake, and image delivery
- D1: application data and durable shiny screenshot job state
- Cloudflare Queues: asynchronous shiny screenshot OCR with retry delivery
- Workers AI: catch-event and shiny screenshot vision extraction
- R2 Standard: catch-event proof images and Discord shiny screenshots
- Durable Objects: Feebas live WebSocket updates
- Cloudflare Images Free transformations: animated grayscale failed-shiny sprites

The former Express routes, PostgreSQL runtime models, Tesseract/sharp OCR, Render keepalive cron, and legacy proxy have been removed. PostgreSQL export utilities remain available for offline migration work.

## Development

From the repository root:

```bash
npm install
npm run dev:api
```

Apply local D1 migrations before testing database-backed changes:

```bash
npm run d1:migrate:local --workspace=@team-soju/api-server
```

Wrangler uses `wrangler.jsonc`, the repository-root `.env`, and remote Workers AI. Local development requires `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` if the local AI binding cannot run remotely.

## Bindings and secrets

Configured bindings:

- `DB`: D1 database
- `SCREENSHOT_STORAGE`: existing R2 Standard screenshot bucket
- `SHINY_OCR_QUEUE`: environment-specific Queue
- `AI`: Workers AI
- `FEEBAS_BOARD_STREAM`: Durable Object

Set secrets independently for production and staging:

```bash
npx wrangler secret put JWT_SECRET --config apps/api-server/wrangler.jsonc
npx wrangler secret put BOT_API_TOKEN --config apps/api-server/wrangler.jsonc
npx wrangler secret put SCREENSHOT_RESULT_CALLBACK_SECRET --config apps/api-server/wrangler.jsonc
```

The callback secret must match the secret on the Discord bot Worker.

## Screenshot OCR flow

`POST /api/shinies/from-screenshot/async` is bot-authenticated and returns `202` with a stable job ID.

1. The API validates a Discord CDN PNG, JPEG, or WebP attachment up to 10 MiB.
2. The image is copied to R2 before the request is acknowledged.
3. D1 stores job state keyed by the Discord interaction ID.
4. A Queue consumer calls Workers AI, validates the result, and inserts the shiny using the job ID.
5. The signed callback updates the original Discord interaction.

Queue redelivery cannot create duplicate shiny records. Callback payloads are persisted before delivery so a callback retry does not repeat OCR.

The synchronous `/api/shinies/from-screenshot` endpoint is retired.

## Grayscale sprite cost guardrail

Failed-shiny embeds keep using:

- `GET /api/shinies/sprites/:nationalNumber/greyscale`
- `GET /api/shinies/sprites/:nationalNumber/greyscale.gif`

The Worker resolves a canonical PokeAPI sprite and requests an animated `saturation: 0` transformation. Cloudflare Images storage is not used and an Images Paid subscription is not required. The Images Free plan currently includes 5,000 unique transformations per month. If transformation fails or the allowance is exhausted, the route returns the original color GIF instead of breaking the embed.

## Deployment

Create the Queues once if they do not already exist:

```bash
npx wrangler queues create team-soju-shiny-ocr
npx wrangler queues create team-soju-shiny-ocr-staging
```

Deploy in this order:

```bash
npm run d1:migrate:staging --workspace=@team-soju/api-server
npm run deploy:cf:staging --workspace=@team-soju/api-server
npm run deploy:cf:staging --workspace=@team-soju/discord-bot

npm run d1:migrate:prod --workspace=@team-soju/api-server
npm run deploy:cf --workspace=@team-soju/api-server
npm run deploy:cf --workspace=@team-soju/discord-bot
```

Smoke-test desktop and mobile `/addshinyscreenshot` commands in staging before production.

## Render retirement

Render is deprecated as of this migration. It must remain removed from all API and Discord traffic. Keep the old service only as a one-week rollback artifact after production verification, then delete the Render service and its external keepalive/restart monitor.

Rollback during that week means reverting the Worker deployment; do not restore the 14-minute restart cron as an active production dependency.

## Monitoring and costs

Monitor:

- Queue retries and failed `shiny_screenshot_jobs`
- callback delivery errors and OCR latency
- Workers AI daily neuron usage
- R2 storage and operations
- Images unique transformation usage

Current Cloudflare allowances can change; confirm them in Cloudflare's pricing pages before changing account plans. The implementation never upgrades a plan or enables Images-hosted storage automatically.

## Tests

```bash
npm run test:api
```

Tests cover Worker routes, D1 repositories, OCR normalization and idempotency, R2 validation, Queue behavior, and grayscale fallback.
