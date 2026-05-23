const {
  buildShinyFilters,
  enrichShinyPayloadWithVariants,
  memberSchema,
  shinySchema,
  updateMemberSchema,
  updateShinySchema,
} = require('./contracts');
const Joi = require('joi');
const {
  authenticateBotRequest,
  clearAuthCookie,
  generateBotToken,
  getTokenFromRequest,
  setAuthCookie,
  signJwt,
  signUserToken,
  verifyJwt,
  verifyUserToken,
} = require('./auth');
const { createRepositories } = require('./repositories');
const { buildCorsHeaders, empty, json, readJson, withStandardHeaders } = require('./http');
const { FeebasRuleError, getLocationConfig } = require('../utils/feebas');
const { isIgnBlacklisted } = require('../utils/ignModeration');

const passwordResetExpiresInMinutes = 60;
const passwordResetSentMessage = 'If an account uses that email, a reset link has been sent.';
const emailVerificationExpiresInMinutes = 24 * 60;
const emailVerificationSentMessage = 'Account created. Check your email to verify it before signing in.';
const discordScopes = ['identify', 'email'];
const passwordMigrationMessage = 'We upgraded account security during the Cloudflare migration. Please reset your password to continue.';
const discordHandoffTokenType = 'discord_oauth_handoff';
const discordHandoffExpiresIn = '2m';
const discordHandoffHashParam = 'discordAuthToken';

const updateFeebasTileSchema = Joi.object({
  status: Joi.string().valid('unchecked', 'checked', 'pending', 'confirmed').required(),
  actorFingerprint: Joi.string().trim().min(8).max(120).required(),
  actorName: Joi.string().trim().allow('', null).max(40).optional(),
});
const feebasActorFingerprintSchema = Joi.string().trim().min(8).max(120).optional();
const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/[0-9]/, 'number')
  .pattern(/[^A-Za-z0-9]/, 'special character')
  .required()
  .messages({
    'string.pattern.name': 'Password must include at least one number and one special character.',
  });
const forgotPasswordSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).lowercase().max(254).required(),
});
const registerSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).lowercase().max(254).required(),
  password: passwordSchema,
  ign: Joi.string().trim().min(1).max(50).required(),
});
const loginSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).lowercase().max(254).required(),
  password: Joi.string().min(1).max(128).required(),
});
const resetPasswordSchema = Joi.object({
  token: Joi.string().trim().min(32).max(256).required(),
  password: passwordSchema,
});
const changeEmailSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).lowercase().max(254).required(),
});
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().allow('', null).max(128),
  newPassword: passwordSchema,
});
const verifyEmailSchema = Joi.object({
  token: Joi.string().trim().min(32).max(256).required(),
});
const discordStartSchema = Joi.object({
  mode: Joi.string().valid('login', 'register', 'connect').default('login'),
  ign: Joi.string().trim().max(50).allow('', null),
  returnTo: Joi.string().trim().max(200).allow('', null),
});
const discordSessionSchema = Joi.object({
  token: Joi.string().trim().min(32).max(2048).required(),
});
const catchEventRuleSchema = Joi.object({
  name: Joi.string().trim().min(1).max(80).required(),
  points: Joi.number().integer().min(-999).max(999).required(),
});
const catchEventCreateSchema = Joi.object({
  id: Joi.string().trim().min(1).max(120).optional(),
  name: Joi.string().trim().min(1).max(160).required(),
  slug: Joi.string().trim().min(1).max(160).required(),
  eventDate: Joi.string().trim().min(4).max(20).required(),
  startLocal: Joi.string().trim().min(8).max(40).required(),
  endLocal: Joi.string().trim().min(8).max(40).required(),
  timezone: Joi.string().trim().min(1).max(80).required(),
  region: Joi.string().valid('Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova').required(),
  route: Joi.string().trim().min(1).max(120).required(),
  winnerCount: Joi.number().integer().min(1).max(10).required(),
  targets: Joi.array().items(Joi.string().trim().min(1).max(80)).min(1).max(20).required(),
  speciesBonuses: Joi.array().items(catchEventRuleSchema).max(20).default([]),
  speciesPenalties: Joi.array().items(catchEventRuleSchema).max(20).default([]),
  natureBonuses: Joi.array().items(catchEventRuleSchema).max(25).default([]),
  naturePenalties: Joi.array().items(catchEventRuleSchema).max(25).default([]),
  useLowestScoreFinalPlace: Joi.boolean().default(true),
  isLeaderboardPublished: Joi.boolean().default(false),
  isPrivate: Joi.boolean().default(true),
  autoCheckEnabled: Joi.boolean().default(false),
});
const catchEventSubmissionSchema = Joi.object({
  playerIgn: Joi.string().trim().min(1).max(50).required(),
  species: Joi.string().trim().min(1).max(80).required(),
  nature: Joi.string().trim().min(1).max(40).required(),
  totalIv: Joi.number().integer().min(0).max(186).required(),
  catchLocal: Joi.string().trim().min(8).max(40).required(),
  timezone: Joi.string().trim().min(1).max(80).required(),
  region: Joi.string().valid('Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova').required(),
  route: Joi.string().trim().min(1).max(120).required(),
  catchUtc: Joi.string().trim().min(8).max(40).required(),
  score: Joi.number().integer().min(-999).max(1186).required(),
  status: Joi.string().valid('pending-verification', 'auto-checked', 'needs-review').required(),
  flags: Joi.array().items(Joi.string().trim().max(200)).max(20).default([]),
  screenshots: Joi.array().items(Joi.object({
    name: Joi.string().trim().min(1).max(160).required(),
    contentType: Joi.string().trim().max(80).default('image/png'),
    dataUrl: Joi.string().max(8 * 1024 * 1024).required(),
  })).max(6).default([]),
});
const catchEventOcrSchema = Joi.object({
  screenshots: Joi.array().items(Joi.object({
    name: Joi.string().trim().allow('', null).max(160),
    contentType: Joi.string().trim().allow('', null).max(80),
    role: Joi.string().valid('nature-ot', 'ivs', 'information').optional(),
    dataUrl: Joi.string().max(8 * 1024 * 1024).required(),
  })).min(1).max(6).required(),
  locale: Joi.string().trim().allow('', null).max(40),
  timezone: Joi.string().trim().allow('', null).max(80),
});
const catchEventPublishSchema = Joi.object({
  isLeaderboardPublished: Joi.boolean().required(),
});
const catchEventSubmissionsClosedSchema = Joi.object({
  submissionsClosed: Joi.boolean().required(),
});
const catchEventAutoCheckSchema = Joi.object({
  autoCheckEnabled: Joi.boolean().required(),
});
const catchEventSubmissionStatusSchema = Joi.object({
  status: Joi.string().valid('pending-verification', 'auto-checked', 'needs-review', 'verified', 'rejected', 'disqualified').required(),
});
const catchEventCollaboratorSchema = Joi.object({
  identifier: Joi.string().trim().min(1).max(254).required(),
});

function getEnvUrl(env, ...keys) {
  const value = keys.map((key) => env[key]).find(Boolean);
  return String(value || 'http://localhost:4321').replace(/\/+$/, '');
}

function getWebAppUrl(env) {
  return getEnvUrl(env, 'WEB_APP_URL', 'FRONTEND_URL');
}

function getApiOrigin(env) {
  return String(env.API_ORIGIN || env.API_BASE_URL || 'http://localhost:8787')
    .replace(/\/api\/?$/, '')
    .replace(/\/+$/, '');
}

function getDiscordRedirectUri(env) {
  return env.DISCORD_REDIRECT_URI || `${getApiOrigin(env)}/api/auth/discord/callback`;
}

function getDiscordConfig(env) {
  const config = {
    clientId: env.DISCORD_CLIENT_ID,
    clientSecret: env.DISCORD_CLIENT_SECRET,
    redirectUri: getDiscordRedirectUri(env),
  };

  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    const error = new Error('Discord OAuth is not configured.');
    error.publicMessage = 'Discord sign-in is not configured yet.';
    throw error;
  }

  return config;
}

function getEmailVerificationUrl(env, token) {
  const redirectUri = getDiscordRedirectUri(env);
  const url = new URL('/api/auth/verify-email', redirectUri);
  url.searchParams.set('token', token);
  return url.toString();
}

function getPasswordResetUrl(env, token) {
  const url = new URL('/auth', getWebAppUrl(env));
  url.searchParams.set('resetToken', token);
  return url.toString();
}

function buildWebRedirect(env, pathname = '/auth', params = {}) {
  const url = new URL(pathname, getWebAppUrl(env));
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

function buildDiscordHandoffRedirect(env, returnTo, token) {
  const url = new URL(buildWebRedirect(env, returnTo, { status: 'signed-in' }));
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  hashParams.set(discordHandoffHashParam, token);
  url.hash = hashParams.toString();
  return url.toString();
}

function redirect(location, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('location', location);
  return new Response(null, {
    status: init.status || 302,
    headers,
  });
}

function sanitizeReturnTo(returnTo) {
  if (!returnTo || typeof returnTo !== 'string') {
    return '/';
  }

  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return '/';
  }

  return returnTo;
}

function getDiscordScopeParam() {
  return discordScopes.map(encodeURIComponent).join('%20');
}

function getBlacklistedIgnMessage() {
  return 'That IGN is not allowed. Please choose a different in-game name.';
}

async function buildState(payload, env) {
  return signJwt(
    {
      type: 'discord_oauth_state',
      mode: payload.mode,
      ign: payload.ign || null,
      userId: payload.userId || null,
      returnTo: sanitizeReturnTo(payload.returnTo),
    },
    env.JWT_SECRET,
    { expiresIn: '10m' }
  );
}

async function verifyState(state, env) {
  const decoded = await verifyJwt(state, env.JWT_SECRET);

  if (decoded?.type !== 'discord_oauth_state') {
    throw new Error('Invalid Discord OAuth state.');
  }

  return {
    mode: decoded.mode === 'register'
      ? 'register'
      : decoded.mode === 'connect'
        ? 'connect'
        : 'login',
    ign: decoded.ign || null,
    userId: decoded.userId || null,
    returnTo: sanitizeReturnTo(decoded.returnTo),
  };
}

async function buildDiscordHandoffToken(user, env) {
  return signJwt(
    {
      type: discordHandoffTokenType,
      sub: user.id,
    },
    env.JWT_SECRET,
    { expiresIn: discordHandoffExpiresIn }
  );
}

async function verifyDiscordHandoffToken(token, env) {
  const decoded = await verifyJwt(token, env.JWT_SECRET);

  if (decoded?.type !== discordHandoffTokenType || !decoded?.sub) {
    throw new Error('Invalid Discord OAuth handoff token.');
  }

  return decoded;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseScreenshotDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) {
    const error = new Error('Screenshot must be a base64 data URL.');
    error.statusCode = 400;
    throw error;
  }

  const [, contentType, base64] = match;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return {
    contentType,
    bytes,
  };
}

function sanitizeFileName(value) {
  return String(value || 'screenshot.png').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);
}

function extractAiResponseText(result) {
  if (!result) return '';
  if (typeof result === 'string') return result;
  if (typeof result.response === 'string') return result.response;
  if (typeof result.result === 'string') return result.result;
  if (typeof result.text === 'string') return result.text;
  if (Array.isArray(result.content)) {
    return result.content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function parseAiJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    throw new Error('OCR returned an empty response.');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('OCR response was not JSON.');
    }
    return JSON.parse(match[0]);
  }
}

function cleanNullableString(value, maxLength = 160) {
  const text = String(value || '').trim();
  if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'unknown') {
    return null;
  }
  return text.slice(0, maxLength);
}

function inferDateOrderFromLocaleTimezone(locale, timezone) {
  const normalizedLocale = String(locale || '').toLowerCase();
  const normalizedTimezone = String(timezone || '').toLowerCase();

  if (/^(en-us|en-ph)\b/.test(normalizedLocale)) return 'mdy';
  if (/^(ja|ko|zh)\b/.test(normalizedLocale)) return 'ymd';
  if (/^(en-gb|en-au|en-nz|en-ie|fr|de|es|it|pt|nl|ru|pl)\b/.test(normalizedLocale)) return 'dmy';

  if (normalizedTimezone.startsWith('america/')) return 'mdy';
  if (
    normalizedTimezone.startsWith('europe/')
    || normalizedTimezone.startsWith('africa/')
    || normalizedTimezone.startsWith('australia/')
  ) {
    return 'dmy';
  }
  if (
    normalizedTimezone === 'asia/tokyo'
    || normalizedTimezone === 'asia/seoul'
    || normalizedTimezone === 'asia/shanghai'
    || normalizedTimezone === 'asia/hong_kong'
    || normalizedTimezone === 'asia/taipei'
  ) {
    return 'ymd';
  }

  return null;
}

function normalizeOcrCatchLocal(value, dateOrder) {
  const text = cleanNullableString(value, 40);
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (isoMatch) {
    const [, year, month, day, hour, minute, second = '00'] = isoMatch;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  }

  const usMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!usMatch) return null;

  const [, rawMonth, rawDay, rawYear, rawHour, minute, rawSecond = '00', meridiem] = usMatch;
  const first = Number(rawMonth);
  const second = Number(rawDay);
  const order = String(dateOrder || '').toLowerCase();
  if (!order && first <= 12 && second <= 12) {
    return null;
  }
  const yearNumber = Number(rawYear);
  const year = yearNumber < 100 ? 2000 + yearNumber : yearNumber;
  const month = order === 'dmy' || (!order && first > 12) ? second : first;
  const day = order === 'dmy' || (!order && first > 12) ? first : second;
  let hour = Number(rawHour);
  if (meridiem?.toUpperCase() === 'PM' && hour < 12) hour += 12;
  if (meridiem?.toUpperCase() === 'AM' && hour === 12) hour = 0;

  return [
    String(year).padStart(4, '0'),
    '-',
    String(month).padStart(2, '0'),
    '-',
    String(day).padStart(2, '0'),
    'T',
    String(hour).padStart(2, '0'),
    ':',
    minute,
    ':',
    rawSecond,
  ].join('');
}

function normalizeCatchEventOcrResult(parsed, fallbackDateOrder = null) {
  const warnings = Array.isArray(parsed?.warnings)
    ? parsed.warnings.map((warning) => cleanNullableString(warning, 200)).filter(Boolean)
    : [];
  const confidence = Number(parsed?.confidence);
  const totalIv = parsed?.totalIv === null || parsed?.totalIv === undefined || parsed?.totalIv === ''
    ? null
    : Number(parsed.totalIv);
  const pokedexNumber = parsed?.pokedexNumber === null || parsed?.pokedexNumber === undefined || parsed?.pokedexNumber === ''
    ? null
    : Number(parsed.pokedexNumber);
  const dateOrder = ['mdy', 'dmy', 'ymd'].includes(String(parsed?.dateOrder || '').toLowerCase())
    ? String(parsed.dateOrder).toLowerCase()
    : fallbackDateOrder;
  if (!parsed?.dateOrder && fallbackDateOrder && cleanNullableString(parsed?.catchLocal || parsed?.catchTime, 40)) {
    warnings.push(`Date order inferred from browser settings as ${fallbackDateOrder.toUpperCase()}.`);
  }

  return {
    playerIgn: cleanNullableString(parsed?.playerIgn || parsed?.ot, 50),
    species: cleanNullableString(parsed?.species || parsed?.pokemon, 80),
    pokedexNumber: Number.isFinite(pokedexNumber) ? pokedexNumber : null,
    nature: cleanNullableString(parsed?.nature, 40),
    totalIv: Number.isFinite(totalIv) ? Math.max(0, Math.min(186, Math.round(totalIv))) : null,
    catchLocal: normalizeOcrCatchLocal(parsed?.catchLocal || parsed?.catchTime, dateOrder),
    catchTimeText: cleanNullableString(parsed?.catchTimeText || parsed?.catchTime, 80),
    location: cleanNullableString(parsed?.location, 120),
    dateOrder,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
    warnings,
  };
}

function mergeCatchEventOcrResults(results) {
  const confidenceValues = results
    .map((result) => result.confidence)
    .filter((confidence) => typeof confidence === 'number');

  return {
    playerIgn: results.find((result) => result.playerIgn)?.playerIgn || null,
    species: results.find((result) => result.species)?.species || null,
    pokedexNumber: results.find((result) => result.pokedexNumber)?.pokedexNumber || null,
    nature: results.find((result) => result.nature)?.nature || null,
    totalIv: results.find((result) => typeof result.totalIv === 'number')?.totalIv ?? null,
    catchLocal: results.find((result) => result.catchLocal)?.catchLocal || null,
    catchTimeText: results.find((result) => result.catchTimeText)?.catchTimeText || null,
    location: results.find((result) => result.location)?.location || null,
    dateOrder: results.find((result) => result.dateOrder)?.dateOrder || null,
    confidence: confidenceValues.length
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : null,
    warnings: results.flatMap((result) => result.warnings || []),
  };
}

function isLocalAiBindingError(error) {
  return /Binding AI needs to be run remotely/i.test(String(error?.message || error || ''));
}

function getCloudflareAiRestConfig(env) {
  const accountId = cleanNullableString(env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID, 120);
  const apiToken = cleanNullableString(
    env.CLOUDFLARE_API_TOKEN || env.CF_API_TOKEN || env.WORKERS_AI_API_TOKEN,
    512
  );

  if (!accountId || !apiToken) {
    return null;
  }

  return { accountId, apiToken };
}

function createLocalAiConfigError() {
  const error = new Error(
    'Workers AI cannot run through the local binding. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to enable screenshot autofill in local worker dev.'
  );
  error.statusCode = 503;
  return error;
}

async function runCloudflareAiRest(env, model, payload) {
  const config = getCloudflareAiRestConfig(env);
  if (!config) {
    throw createLocalAiConfigError();
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${model}`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
  const body = await response.json().catch(() => null);

  if (!response.ok || body?.success === false) {
    const message = body?.errors?.[0]?.message || body?.message || 'Workers AI request failed.';
    const error = new Error(message);
    error.statusCode = response.status >= 400 && response.status < 500 ? response.status : 502;
    throw error;
  }

  return body?.result ?? body;
}

async function runCatchEventOcrModel(env, model, payload) {
  if (env.AI && typeof env.AI.run === 'function') {
    try {
      return await env.AI.run(model, payload);
    } catch (error) {
      if (!isLocalAiBindingError(error)) {
        throw error;
      }
    }
  }

  if (!env.AI && !getCloudflareAiRestConfig(env)) {
    const error = new Error('OCR is not configured for this environment.');
    error.statusCode = 503;
    throw error;
  }

  return runCloudflareAiRest(env, model, payload);
}

async function extractCatchEventScreenshotFields(env, screenshots, context = {}) {
  const fallbackDateOrder = inferDateOrderFromLocaleTimezone(context.locale, context.timezone);
  const model = env.CATCH_EVENT_OCR_MODEL || '@cf/google/gemma-3-12b-it';
  const results = await Promise.all(screenshots.map(async (screenshot, index) => {
    const roleInstructions = {
      'nature-ot': 'This is the Nature/OT screenshot. Only extract species from "Name:", nature from "Nature:", OT/playerIgn from "OT:", and pokedexNumber from "Pokedex:". Leave IV, date, and location fields null.',
      ivs: 'This is the IVs screenshot. Only extract totalIv from the "Total:" row. Leave species, nature, OT, date, and location fields null.',
      information: 'This is the Information screenshot. Only extract location and catchLocal/catchTimeText from the information text. Leave species, nature, OT, and IV fields null.',
    };
    const prompt = [
    `Read only the left half of this PokeMMO Pokemon Summary screenshot for catch event submission autofill. This is screenshot ${index + 1} of ${screenshots.length}${screenshot.name ? ` named ${screenshot.name}` : ''}.`,
    roleInstructions[screenshot.role] || 'It may show the summary tab, IV tab, or information tab.',
    'Ignore the Pokemon art, nickname/level area, held item area, and everything on the right half.',
    'Extract only visible values. Do not infer missing values.',
    'playerIgn must come only from the left-side "OT:" field.',
    'species must come only from the left-side "Name:" field.',
    'nature must come only from the left-side "Nature:" field. If stat modifiers are shown in brackets, omit them.',
    'totalIv must come only from the left-side "Total:" IV row.',
    'Return JSON only, with this exact shape:',
    '{"playerIgn": string|null, "species": string|null, "pokedexNumber": number|null, "nature": string|null, "totalIv": number|null, "catchLocal": "YYYY-MM-DDTHH:mm:ss"|null, "catchTimeText": string|null, "dateOrder": "mdy"|"dmy"|"ymd"|null, "location": string|null, "confidence": number, "warnings": string[]}',
    'For the Information tab, location is the text after Hatched/Caught in, before "after" when present.',
    'For numeric dates, use the screenshot/client language or locale cues to decide MM/DD/YY versus DD/MM/YY. Set dateOrder to mdy, dmy, or ymd.',
    fallbackDateOrder
      ? `If a numeric date is ambiguous and no screenshot locale cue is visible, use browser fallback dateOrder ${fallbackDateOrder}.`
      : 'If a numeric date is ambiguous, such as 4/12/26, and no locale cue is visible, leave catchLocal null, keep the original in catchTimeText, and add a warning.',
    'If the total is shown as "140 / 186", totalIv is 140.',
    ].join('\n');
    const result = await runCatchEventOcrModel(env, model, {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: screenshot.dataUrl,
              },
            },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 600,
    });

    return normalizeCatchEventOcrResult(parseAiJson(extractAiResponseText(result)), fallbackDateOrder);
  }));

  return mergeCatchEventOcrResults(results);
}

async function storeCatchEventScreenshots(env, eventId, submissionId, screenshots, requestUrl) {
  if (!screenshots.length) return [];
  if (!env.CATCH_EVENT_SCREENSHOTS) {
    const error = new Error('Catch event screenshot storage is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const origin = new URL(requestUrl).origin;
  return Promise.all(screenshots.map(async (screenshot) => {
    const id = randomHex(16);
    const parsed = parseScreenshotDataUrl(screenshot.dataUrl);
    const fileName = sanitizeFileName(screenshot.name);
    const storageKey = `catch-events/${eventId}/${submissionId}/${id}-${fileName}`;

    await env.CATCH_EVENT_SCREENSHOTS.put(storageKey, parsed.bytes, {
      httpMetadata: {
        contentType: screenshot.contentType || parsed.contentType,
      },
    });

    return {
      id,
      fileName,
      contentType: screenshot.contentType || parsed.contentType,
      storageKey,
      url: `${origin}/api/catch-events/screenshots/${id}`,
    };
  }));
}

function buildPasswordResetMessage({ to, resetUrl, expiresInMinutes, ign }) {
  const displayName = ign ? ` ${ign}` : '';
  const escapedDisplayName = escapeHtml(displayName);
  const escapedResetUrl = escapeHtml(resetUrl);
  return {
    to,
    subject: 'Reset your Team Soju password',
    text: [
      `Hi${displayName},`,
      '',
      'Use this link to reset your Team Soju password:',
      resetUrl,
      '',
      `This link expires in ${expiresInMinutes} minutes.`,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: `
      <p>Hi${escapedDisplayName},</p>
      <p>Use this link to reset your Team Soju password:</p>
      <p><a href="${escapedResetUrl}">Reset your password</a></p>
      <p>This link expires in ${expiresInMinutes} minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  };
}

function buildEmailVerificationMessage({ to, verificationUrl, expiresInMinutes, ign }) {
  const displayName = ign ? ` ${ign}` : '';
  const escapedDisplayName = escapeHtml(displayName);
  const escapedVerificationUrl = escapeHtml(verificationUrl);
  return {
    to,
    subject: 'Verify your Team Soju email',
    text: [
      `Hi${displayName},`,
      '',
      'Use this link to verify your Team Soju email before signing in:',
      verificationUrl,
      '',
      `This link expires in ${expiresInMinutes} minutes.`,
      '',
      'If you did not create this account, you can ignore this email.',
    ].join('\n'),
    html: `
      <p>Hi${escapedDisplayName},</p>
      <p>Use this link to verify your Team Soju email before signing in:</p>
      <p><a href="${escapedVerificationUrl}">Verify your email</a></p>
      <p>This link expires in ${expiresInMinutes} minutes.</p>
      <p>If you did not create this account, you can ignore this email.</p>
    `,
  };
}

async function sendEmail(fetchImpl, env, message) {
  const provider = String(env.EMAIL_PROVIDER || (env.NODE_ENV === 'production' ? 'resend' : 'console')).trim().toLowerCase();
  if (provider === 'console') {
    if (env.NODE_ENV !== 'test') {
      console.log(`${message.subject} email for ${message.to}:\n${message.text}`);
    }
    return { provider: 'console' };
  }

  if (provider === 'resend') {
    if (!env.RESEND_API_KEY || !(env.EMAIL_FROM || env.RESEND_FROM)) {
      const error = new Error('Resend email is not configured.');
      error.publicMessage = 'Email delivery is not configured yet.';
      throw error;
    }

    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM || env.RESEND_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!response.ok) {
      const error = new Error('Resend email request failed.');
      error.publicMessage = 'Email delivery is not configured yet.';
      throw error;
    }
    return response.json();
  }

  if (provider === 'postmark') {
    if (!env.POSTMARK_SERVER_TOKEN || !(env.EMAIL_FROM || env.POSTMARK_FROM)) {
      const error = new Error('Postmark email is not configured.');
      error.publicMessage = 'Email delivery is not configured yet.';
      throw error;
    }

    const body = {
      From: env.EMAIL_FROM || env.POSTMARK_FROM,
      To: message.to,
      Subject: message.subject,
      TextBody: message.text,
      HtmlBody: message.html,
    };
    if (env.POSTMARK_MESSAGE_STREAM) {
      body.MessageStream = env.POSTMARK_MESSAGE_STREAM;
    }

    const response = await fetchImpl('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': env.POSTMARK_SERVER_TOKEN,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = new Error('Postmark email request failed.');
      error.publicMessage = 'Email delivery is not configured yet.';
      throw error;
    }
    return response.json();
  }

  const error = new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
  error.publicMessage = 'Email delivery is not configured yet.';
  throw error;
}

async function exchangeDiscordCode(fetchImpl, env, code) {
  const { clientId, clientSecret, redirectUri } = getDiscordConfig(env);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetchImpl('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error('Discord token exchange failed.');
  }

  return response.json();
}

async function fetchDiscordUser(fetchImpl, accessToken) {
  const response = await fetchImpl('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Discord user fetch failed.');
  }

  return response.json();
}

function getCrypto() {
  return globalThis.crypto || require('crypto').webcrypto;
}

function randomHex(byteLength) {
  const bytes = new Uint8Array(byteLength);
  getCrypto().getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value) {
  const digest = await getCrypto().subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function derivePasswordHash(password, saltHex = randomHex(16), iterations = 100000) {
  const salt = Uint8Array.from(saltHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
  const key = await getCrypto().subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await getCrypto().subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt,
    iterations,
  }, key, 256);
  const hashHex = Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `pbkdf2_sha256$${iterations}$${saltHex}$${hashHex}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash) return false;

  if (storedHash.startsWith('pbkdf2_sha256$')) {
    const [, iterations, saltHex, expectedHash] = storedHash.split('$');
    const actualHash = await derivePasswordHash(password, saltHex, Number(iterations));
    return actualHash.endsWith(`$${expectedHash}`);
  }

  return false;
}

function isExpired(expiresAt) {
  const expiresAtMs = new Date(expiresAt).getTime();
  return !Number.isFinite(expiresAtMs) || expiresAtMs < Date.now();
}

function duplicateAuthMessage(error) {
  const message = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  if (!message.includes('unique') && error?.code !== '23505') {
    return null;
  }
  if (message.includes('ign')) return 'That IGN is already in use.';
  if (message.includes('email')) return 'An account with that email already exists.';
  return 'An account with that email or IGN already exists.';
}

function isLocalhost(value) {
  try {
    const url = new URL(value);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function shouldNormalizeLegacyCookie(request, env) {
  return env.NODE_ENV !== 'production' || isLocalhost(request.url) || isLocalhost(env.API_ORIGIN || env.API_BASE_URL || '');
}

function normalizeLegacySetCookie(cookieHeader) {
  return cookieHeader
    .split(';')
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment.toLowerCase() !== 'secure' && !segment.toLowerCase().startsWith('samesite='))
    .concat('SameSite=Lax')
    .join('; ');
}

function encodeFeebasSocketMessage(payload) {
  return JSON.stringify(payload);
}

function createFeebasStreamDurableObjectRequest(pathname, location, actorFingerprint, init = {}) {
  const url = new URL(`https://feebas-board-stream.local${pathname}`);
  url.searchParams.set('location', location);

  if (actorFingerprint) {
    url.searchParams.set('actorFingerprint', actorFingerprint);
  }

  return new Request(url.toString(), init);
}

const feebasSocketMetadataFallback = new WeakMap();

function isWebSocketUpgrade(request) {
  return request.headers.get('upgrade')?.toLowerCase() === 'websocket';
}

function webSocketUpgradeRequired() {
  return json({
    success: false,
    message: 'Expected WebSocket upgrade',
  }, {
    status: 426,
    headers: {
      Upgrade: 'websocket',
    },
  });
}

function createWebSocketPair() {
  if (typeof WebSocketPair === 'undefined') {
    throw new Error('WebSocketPair is not available in this runtime.');
  }

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  return { client, server };
}

function createWebSocketUpgradeResponse(client) {
  try {
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  } catch (error) {
    if (error instanceof RangeError || error?.name === 'RangeError') {
      const response = new Response(null, { status: 200 });
      Object.defineProperty(response, 'status', {
        configurable: true,
        value: 101,
      });
      Object.defineProperty(response, 'webSocket', {
        configurable: true,
        value: client,
      });
      return response;
    }

    throw error;
  }
}

function serializeFeebasSocketMetadata(socket, metadata) {
  if (typeof socket.serializeAttachment === 'function') {
    socket.serializeAttachment(metadata);
    return;
  }

  feebasSocketMetadataFallback.set(socket, metadata);
}

function deserializeFeebasSocketMetadata(socket) {
  if (typeof socket.deserializeAttachment === 'function') {
    const attachment = socket.deserializeAttachment();
    if (attachment) {
      return attachment;
    }
  }

  return feebasSocketMetadataFallback.get(socket) || null;
}

function sendFeebasSocketBoard(socket, board) {
  socket.send(encodeFeebasSocketMessage({ success: true, data: board }));
}

function getFeebasStreamDurableObject(env, location) {
  const namespace = env?.FEEBAS_BOARD_STREAM;

  if (
    !namespace
    || typeof namespace.idFromName !== 'function'
    || typeof namespace.get !== 'function'
  ) {
    return null;
  }

  return namespace.get(namespace.idFromName(location));
}

class FeebasBoardStreamDurableObject {
  constructor(state, env, options = {}) {
    this.state = state;
    this.env = env;
    this.createRepositories = options.createRepositories || createRepositories;
  }

  async fetch(request) {
    const url = new URL(request.url);

    try {
      if (request.method === 'GET' && url.pathname === '/stream') {
        return this.openSocket(request, url);
      }

      if (request.method === 'POST' && url.pathname === '/broadcast') {
        await this.broadcast(url.searchParams.get('location'));
        return new Response(null, { status: 204 });
      }

      return json({ success: false, message: 'Endpoint not found' }, { status: 404 });
    } catch (error) {
      if (error instanceof FeebasRuleError) {
        return json({ success: false, message: error.message }, { status: error.statusCode });
      }

      console.error('Error handling Feebas stream Durable Object request:', error);
      return json({ success: false, message: 'Failed to handle Feebas stream request' }, { status: 500 });
    }
  }

  async openSocket(request, url) {
    if (!isWebSocketUpgrade(request)) {
      return webSocketUpgradeRequired();
    }

    if (!this.state || typeof this.state.acceptWebSocket !== 'function') {
      throw new Error('Durable Object WebSocket hibernation is not available.');
    }

    const location = url.searchParams.get('location');
    getLocationConfig(location);

    const actorFingerprint = feebasActorFingerprintSchema.validate(url.searchParams.get('actorFingerprint') || undefined).value;
    const repositories = this.createRepositories(this.env);
    const board = await repositories.feebas.getBoard(location, {
      actorFingerprint,
      includeLeaderboard: false,
    });
    const { client, server } = createWebSocketPair();
    const metadata = {
      location,
      actorFingerprint,
    };

    this.state.acceptWebSocket(server);
    serializeFeebasSocketMetadata(server, metadata);
    sendFeebasSocketBoard(server, board);

    return createWebSocketUpgradeResponse(client);
  }

  async broadcast(location) {
    getLocationConfig(location);

    const sockets = typeof this.state?.getWebSockets === 'function'
      ? this.state.getWebSockets()
      : [];
    const subscribers = sockets
      .map((socket) => ({
        socket,
        metadata: deserializeFeebasSocketMetadata(socket),
      }))
      .filter((subscriber) => subscriber.metadata?.location === location);

    if (subscribers.length === 0) {
      return;
    }

    const repositories = this.createRepositories(this.env);
    const boardCache = await repositories.feebas.getBoardCache(location);

    await Promise.all(subscribers.map(async (subscriber) => {
      try {
        const board = subscriber.metadata.actorFingerprint
          ? repositories.feebas.applyUserViewToBoardCache(boardCache, subscriber.metadata.actorFingerprint)
          : boardCache;
        sendFeebasSocketBoard(subscriber.socket, board);
      } catch {
        try {
          subscriber.socket.close(1011, 'Failed to refresh Feebas board');
        } catch {
          // Ignore sockets that are already closed.
        }
      }
    }));
  }

  webSocketClose(socket) {
    try {
      socket.close();
    } catch {
      // The socket may already be closed by the runtime.
    }
  }

  webSocketError(socket) {
    try {
      socket.close(1011, 'Feebas live updates failed');
    } catch {
      // The socket may already be closed by the runtime.
    }
  }
}

function createWorkerApp(options = {}) {
  const createRepos = options.createRepositories || createRepositories;
  const fetchImpl = options.fetch || fetch;
  const feebasSubscribersByLocation = new Map();

  function removeFeebasSubscriber(location, subscriber) {
    const subscribers = feebasSubscribersByLocation.get(location);
    if (!subscribers) return;

    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      feebasSubscribersByLocation.delete(location);
    }
  }

  function createFeebasSocketResponse(request, location, actorFingerprint, board) {
    if (!isWebSocketUpgrade(request)) {
      return webSocketUpgradeRequired();
    }

    let subscriber;
    let isClosed = false;
    const subscribers = feebasSubscribersByLocation.get(location) || new Set();
    const { client, server } = createWebSocketPair();

    const cleanup = () => {
      if (isClosed) {
        return;
      }

      isClosed = true;
      removeFeebasSubscriber(location, subscriber);
      try {
        server.close();
      } catch {
        // The socket may already be closed by the client.
      }
    };

    const handleAbort = () => {
      cleanup();
    };

    subscriber = { socket: server, actorFingerprint, cleanup };
    subscribers.add(subscriber);
    feebasSubscribersByLocation.set(location, subscribers);

    if (typeof server.accept === 'function') {
      server.accept();
    }

    sendFeebasSocketBoard(server, board);

    server.addEventListener?.('close', cleanup);
    server.addEventListener?.('error', cleanup);
    request.signal?.addEventListener('abort', handleAbort, { once: true });
    subscriber.cleanup = () => {
      request.signal?.removeEventListener('abort', handleAbort);
      server.removeEventListener?.('close', cleanup);
      server.removeEventListener?.('error', cleanup);
      cleanup();
    };

    return createWebSocketUpgradeResponse(client);
  }

  async function broadcastFeebasBoard(location, repositories, env) {
    const durableObject = getFeebasStreamDurableObject(env, location);

    if (durableObject) {
      try {
        await durableObject.fetch(createFeebasStreamDurableObjectRequest('/broadcast', location, null, {
          method: 'POST',
        }));
      } catch (error) {
        console.error('Error broadcasting Feebas board through Durable Object:', error);
      }
      return;
    }

    const subscribers = feebasSubscribersByLocation.get(location);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const boardCache = await repositories.feebas.getBoardCache(location);

    await Promise.all(Array.from(subscribers).map(async (subscriber) => {
      try {
        const board = subscriber.actorFingerprint
          ? repositories.feebas.applyUserViewToBoardCache(boardCache, subscriber.actorFingerprint)
          : boardCache;
        sendFeebasSocketBoard(subscriber.socket, board);
      } catch {
        subscriber.cleanup?.();
      }
    }));
  }

  async function maybeProxyLegacyRequest(request, env) {
    const url = new URL(request.url);
    const legacyBase = env.LEGACY_API_BASE_URL;
    if (!legacyBase) {
      return json({
        success: false,
        message: 'This endpoint is still served by the legacy Node API. Configure LEGACY_API_BASE_URL to proxy it during migration.',
      }, { status: 501 });
    }

    const proxyUrl = new URL(url.pathname + url.search, legacyBase);
    const response = await fetchImpl(proxyUrl, {
      method: request.method,
      headers: request.headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.clone().arrayBuffer(),
    });

    if (url.pathname.startsWith('/api/auth/') && shouldNormalizeLegacyCookie(request, env)) {
      const headers = new Headers(response.headers);
      const setCookies = typeof headers.getSetCookie === 'function'
        ? headers.getSetCookie()
        : [headers.get('set-cookie')].filter(Boolean);

      if (setCookies.length > 0) {
        headers.delete('set-cookie');
        setCookies.forEach((cookie) => {
          headers.append('set-cookie', normalizeLegacySetCookie(cookie));
        });

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    }

    return response;
  }

  function isLegacyProxyPath(pathname) {
    const workerAuthPaths = new Set([
      '/api/auth/me',
      '/api/auth/logout',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/auth/change-email',
      '/api/auth/change-password',
      '/api/auth/verify-email',
      '/api/auth/register',
      '/api/auth/login',
      '/api/auth/discord',
      '/api/auth/discord/session',
      '/api/auth/discord/callback',
    ]);

    return pathname === '/api/shinies/from-screenshot'
      || pathname === '/api/shinies/from-screenshot/async'
      || pathname.startsWith('/api/shinies/sprites/')
      || (pathname.startsWith('/api/auth/') && !workerAuthPaths.has(pathname));
  }

  async function requireBotAuth(request, env) {
    const auth = await authenticateBotRequest(request, env);
    if (!auth.ok) {
      return json(auth.response.body, { status: auth.response.status });
    }
    return null;
  }

  async function getAuthenticatedUser(request, env, repositories) {
    const token = getTokenFromRequest(request, env);
    if (!token) return null;

    try {
      const decoded = await verifyUserToken(token, env);
      return repositories.users.findById(decoded.sub);
    } catch {
      return null;
    }
  }

  async function requireUser(request, env, repositories) {
    const token = getTokenFromRequest(request, env);
    if (!token) {
      return {
        response: json({ success: false, message: 'Not signed in.' }, { status: 401 }),
      };
    }

    try {
      const decoded = await verifyUserToken(token, env);
      const user = await repositories.users.findById(decoded.sub);
      if (!user) {
        return {
          response: json({
            success: false,
            message: 'Invalid or expired session.',
          }, {
            status: 401,
            headers: { 'set-cookie': clearAuthCookie(env) },
          }),
        };
      }
      return { user };
    } catch {
      return {
        response: json({ success: false, message: 'Invalid or expired session.' }, { status: 401 }),
      };
    }
  }

  async function signInUser(env, repositories, user, statusCode = 200, message = 'Signed in successfully.') {
    const loggedInUser = await repositories.users.recordLogin(user.id);
    const safeUser = repositories.users.toSafeUser(loggedInUser || user);
    const token = await signUserToken(safeUser, env);

    return json({
      success: true,
      data: safeUser,
      message,
    }, {
      status: statusCode,
      headers: { 'set-cookie': setAuthCookie(token, env) },
    });
  }

  async function issueEmailVerification(fetchImpl, env, repositories, user) {
    const token = randomHex(32);
    const expiresAt = new Date(Date.now() + (emailVerificationExpiresInMinutes * 60 * 1000));

    await repositories.users.setEmailVerificationToken(user.id, {
      tokenHash: await sha256Hex(token),
      expiresAt,
    });

    await sendEmail(fetchImpl, env, buildEmailVerificationMessage({
      to: user.email,
      verificationUrl: getEmailVerificationUrl(env, token),
      expiresInMinutes: emailVerificationExpiresInMinutes,
      ign: user.ign,
    }));
  }

  async function routeRequest(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    let repositories;
    const getRepositories = () => {
      repositories = repositories || options.repositories || createRepos(env);
      return repositories;
    };

    if (request.method === 'OPTIONS') {
      return empty(204, { headers: buildCorsHeaders(request, env) });
    }

    if (isLegacyProxyPath(pathname)) {
      return maybeProxyLegacyRequest(request, env, ctx);
    }

    if (request.method === 'GET' && pathname === '/health') {
      return json({
        success: true,
        message: 'Team Soju API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      });
    }

    if (request.method === 'GET' && pathname === '/generate-bot-token') {
      if (env.NODE_ENV === 'production') {
        return json({
          success: false,
          message: 'Token generation not available in production',
        }, { status: 403 });
      }

      const token = await generateBotToken(env.JWT_SECRET);
      return json({
        success: true,
        token,
        message: 'Bot token generated successfully',
      });
    }

    if (request.method === 'POST' && pathname === '/api/auth/register') {
      try {
        const body = await readJson(request);
        const { error, value } = registerSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        if (isIgnBlacklisted(value.ign)) {
          return json({
            success: false,
            message: getBlacklistedIgnMessage(),
          }, { status: 400 });
        }

        const verificationToken = randomHex(32);
        const user = await getRepositories().users.createWithPassword({
          email: value.email,
          passwordHash: await derivePasswordHash(value.password),
          ign: value.ign,
          verificationTokenHash: await sha256Hex(verificationToken),
          verificationExpiresAt: new Date(Date.now() + (emailVerificationExpiresInMinutes * 60 * 1000)),
        });

        try {
          await sendEmail(fetchImpl, env, buildEmailVerificationMessage({
            to: user.email,
            verificationUrl: getEmailVerificationUrl(env, verificationToken),
            expiresInMinutes: emailVerificationExpiresInMinutes,
            ign: user.ign,
          }));
        } catch (sendError) {
          await getRepositories().users.deleteById(user.id).catch((deleteError) => {
            console.error('Error deleting unverified user after email failure:', deleteError);
          });
          throw sendError;
        }

        return json({
          success: true,
          data: null,
          message: emailVerificationSentMessage,
        }, { status: 201 });
      } catch (error) {
        const duplicateMessage = duplicateAuthMessage(error);
        if (duplicateMessage) {
          return json({ success: false, message: duplicateMessage }, { status: 409 });
        }

        console.error('Error registering user:', error);
        return json({
          success: false,
          message: error.publicMessage || 'Failed to create account',
        }, { status: error.publicMessage ? 503 : 500 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/auth/login') {
      try {
        const body = await readJson(request);
        const { error, value } = loginSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const user = await getRepositories().users.findByEmail(value.email);
        if (user?.password_hash?.startsWith('$2')) {
          return json({
            success: false,
            message: passwordMigrationMessage,
          }, { status: 403 });
        }

        const passwordMatches = user?.password_hash
          ? await verifyPassword(value.password, user.password_hash)
          : false;

        if (!user || !passwordMatches) {
          return json({
            success: false,
            message: 'Invalid email or password',
          }, { status: 401 });
        }

        if (!user.email_verified_at) {
          try {
            await issueEmailVerification(fetchImpl, env, getRepositories(), user);
          } catch (sendError) {
            console.error('Error resending verification email:', sendError);
            return json({
              success: false,
              message: sendError.publicMessage || 'Failed to send verification email',
            }, { status: sendError.publicMessage ? 503 : 500 });
          }

          return json({
            success: false,
            message: 'Verify your email before signing in. We sent you a new verification link.',
          }, { status: 403 });
        }

        return signInUser(env, getRepositories(), user);
      } catch (error) {
        console.error('Error signing in user:', error);
        return json({ success: false, message: 'Failed to sign in' }, { status: 500 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/auth/discord') {
      try {
        const { error, value } = discordStartSchema.validate(Object.fromEntries(url.searchParams.entries()));
        if (error) {
          return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Invalid Discord sign-in request.' }), 302);
        }

        if (value.mode === 'register' && !value.ign) {
          return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Enter your IGN before continuing with Discord.' }), 302);
        }

        if (value.mode === 'register' && value.ign && isIgnBlacklisted(value.ign)) {
          return Response.redirect(buildWebRedirect(env, '/auth', { error: getBlacklistedIgnMessage() }), 302);
        }

        let userId = null;
        if (value.mode === 'connect') {
          const auth = await requireUser(request, env, getRepositories());
          if (auth.response) {
            return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Sign in before connecting Discord.' }), 302);
          }
          userId = auth.user.id;
        }

        const { clientId, redirectUri } = getDiscordConfig(env);
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          state: await buildState({ ...value, userId }, env),
        });

        return Response.redirect(`https://discord.com/oauth2/authorize?${params.toString()}&scope=${getDiscordScopeParam()}`, 302);
      } catch (error) {
        console.error('Error starting Discord OAuth:', error);
        return Response.redirect(buildWebRedirect(env, '/auth', {
          error: error.publicMessage || 'Unable to start Discord sign-in.',
        }), 302);
      }
    }

    if (request.method === 'GET' && pathname === '/api/auth/discord/callback') {
      try {
        if (url.searchParams.get('error')) {
          return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Discord sign-in was cancelled.' }), 302);
        }

        const code = url.searchParams.get('code');
        const rawState = url.searchParams.get('state');
        if (!code || !rawState) {
          return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Discord sign-in did not return the expected data.' }), 302);
        }

        const state = await verifyState(rawState, env);
        if (state.mode === 'register' && state.ign && isIgnBlacklisted(state.ign)) {
          return Response.redirect(buildWebRedirect(env, '/auth', { error: getBlacklistedIgnMessage() }), 302);
        }

        const token = await exchangeDiscordCode(fetchImpl, env, code);
        const discordUser = await fetchDiscordUser(fetchImpl, token.access_token);

        if (!discordUser.email) {
          return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Discord did not return an email address.' }), 302);
        }

        if (discordUser.verified === false) {
          return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Verify your Discord email before signing in.' }), 302);
        }

        let user = await getRepositories().users.findByDiscordId(discordUser.id);

        if (state.mode === 'connect') {
          if (!state.userId) {
            return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Discord connection session expired. Please try again.' }), 302);
          }

          const currentUser = await getRepositories().users.findById(state.userId);
          if (!currentUser) {
            return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Sign in before connecting Discord.' }), 302);
          }

          if (user && user.id !== currentUser.id) {
            return Response.redirect(buildWebRedirect(env, '/auth', { error: 'That Discord account is already connected to another Team Soju account.' }), 302);
          }

          user = user?.id === currentUser.id
            ? user
            : await getRepositories().users.attachDiscord(currentUser.id, discordUser);
        } else if (!user) {
          const userByEmail = await getRepositories().users.findByEmail(discordUser.email);
          if (userByEmail) {
            user = await getRepositories().users.attachDiscord(userByEmail.id, discordUser);
          } else if (state.mode === 'register' && state.ign) {
            user = await getRepositories().users.createWithDiscord({
              email: discordUser.email,
              ign: state.ign,
              discord: discordUser,
            });
          } else {
            return Response.redirect(buildWebRedirect(env, '/auth', {
              mode: 'register',
              error: 'No Team Soju account is linked to that Discord account yet.',
            }), 302);
          }
        }

        const loggedInUser = await getRepositories().users.recordLogin(user.id);
        const safeUser = getRepositories().users.toSafeUser(loggedInUser || user);
        const sessionToken = await signUserToken(safeUser, env);
        const handoffToken = await buildDiscordHandoffToken(safeUser, env);

        return redirect(buildDiscordHandoffRedirect(env, state.returnTo, handoffToken), {
          headers: { 'set-cookie': setAuthCookie(sessionToken, env) },
        });
      } catch (error) {
        const duplicateMessage = duplicateAuthMessage(error);
        if (duplicateMessage) {
          return Response.redirect(buildWebRedirect(env, '/auth', { error: duplicateMessage }), 302);
        }

        console.error('Error completing Discord OAuth:', error);
        return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Unable to complete Discord sign-in.' }), 302);
      }
    }

    if (request.method === 'POST' && pathname === '/api/auth/discord/session') {
      try {
        const body = await readJson(request);
        const { error, value } = discordSessionSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const session = await verifyDiscordHandoffToken(value.token, env);
        const user = await getRepositories().users.findById(session.sub);
        if (!user) {
          return json({
            success: false,
            message: 'Discord sign-in session expired. Please try again.',
          }, { status: 401 });
        }

        const safeUser = getRepositories().users.toSafeUser(user);
        const token = await signUserToken(safeUser, env);
        return json({
          success: true,
          data: safeUser,
          message: 'Signed in successfully.',
        }, {
          headers: { 'set-cookie': setAuthCookie(token, env) },
        });
      } catch {
        return json({
          success: false,
          message: 'Discord sign-in session expired. Please try again.',
        }, { status: 401 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/auth/me') {
      const token = getTokenFromRequest(request, env);

      if (!token) {
        return json({
          success: true,
          data: null,
        });
      }

      try {
        const decoded = await verifyUserToken(token, env);
        const user = await getRepositories().users.findById(decoded.sub);

        if (!user) {
          if (env.LEGACY_API_BASE_URL && shouldNormalizeLegacyCookie(request, env)) {
            return maybeProxyLegacyRequest(request, env, ctx);
          }

          return json({
            success: true,
            data: null,
          }, {
            headers: {
              'set-cookie': clearAuthCookie(env),
            },
          });
        }

        return json({
          success: true,
          data: getRepositories().users.toSafeUser(user),
        });
      } catch {
        return json({
          success: false,
          message: 'Invalid or expired session.',
        }, {
          status: 401,
          headers: {
            'set-cookie': clearAuthCookie(env),
          },
        });
      }
    }

    if (request.method === 'POST' && pathname === '/api/auth/logout') {
      return json({
        success: true,
        message: 'Signed out successfully.',
      }, {
        headers: { 'set-cookie': clearAuthCookie(env) },
      });
    }

    if (request.method === 'POST' && pathname === '/api/auth/forgot-password') {
      try {
        const body = await readJson(request);
        const { error, value } = forgotPasswordSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const user = await getRepositories().users.findByEmail(value.email);
        const emailHash = await sha256Hex(value.email);
        console.log('Password reset request processed:', {
          emailHashPrefix: emailHash.slice(0, 8),
          userFound: Boolean(user),
        });
        if (user) {
          const token = randomHex(32);
          const tokenHash = await sha256Hex(token);
          const expiresAt = new Date(Date.now() + (passwordResetExpiresInMinutes * 60 * 1000));
          await getRepositories().users.setPasswordResetToken(user.id, {
            tokenHash,
            expiresAt,
          });
          console.log('Password reset token stored:', {
            userId: user.id,
            tokenHashPrefix: tokenHash.slice(0, 8),
            expiresAt: expiresAt.toISOString(),
          });

          try {
            await sendEmail(fetchImpl, env, buildPasswordResetMessage({
              to: user.email,
              resetUrl: getPasswordResetUrl(env, token),
              expiresInMinutes: passwordResetExpiresInMinutes,
              ign: user.ign,
            }));
          } catch (sendError) {
            await getRepositories().users.clearPasswordResetToken(user.id).catch((clearError) => {
              console.error('Error clearing failed password reset token:', clearError);
            });
            throw sendError;
          }
        }

        return json({ success: true, message: passwordResetSentMessage });
      } catch (error) {
        console.error('Error requesting password reset:', error);
        return json({
          success: false,
          message: error.publicMessage || 'Failed to request password reset',
        }, { status: error.publicMessage ? 503 : 500 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/auth/reset-password') {
      try {
        const body = await readJson(request);
        const { error, value } = resetPasswordSchema.validate(body);
        if (error) {
          console.warn('Password reset validation failed:', error.details.map((detail) => detail.message));
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const tokenHash = await sha256Hex(value.token);
        const user = await getRepositories().users.findByPasswordResetTokenHash(tokenHash);
        if (!user || isExpired(user.password_reset_expires_at)) {
          console.warn('Password reset token rejected:', {
            tokenHashPrefix: tokenHash.slice(0, 8),
            userFound: Boolean(user),
            expiresAt: user?.password_reset_expires_at || null,
            workerNow: new Date().toISOString(),
          });
          if (user) {
            await getRepositories().users.clearPasswordResetToken(user.id);
          }
          return json({
            success: false,
            message: 'That password reset link is invalid or expired.',
          }, { status: 400 });
        }

        const updatedUser = await getRepositories().users.updatePassword(user.id, await derivePasswordHash(value.password));
        return signInUser(env, getRepositories(), updatedUser || user, 200, 'Password reset successfully.');
      } catch (error) {
        console.error('Error resetting password:', error);
        return json({ success: false, message: 'Failed to reset password' }, { status: 500 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/auth/change-email') {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const body = await readJson(request);
        const { error, value } = changeEmailSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const normalizedEmail = getRepositories().users.normalizeEmail(value.email);
        if (normalizedEmail === auth.user.email) {
          return json({
            success: false,
            message: 'That is already your current email address.',
          }, { status: 400 });
        }

        const verificationToken = randomHex(32);
        const updatedUser = await getRepositories().users.updateEmail(auth.user.id, {
          email: normalizedEmail,
          tokenHash: await sha256Hex(verificationToken),
          expiresAt: new Date(Date.now() + (emailVerificationExpiresInMinutes * 60 * 1000)),
        });

        await sendEmail(fetchImpl, env, buildEmailVerificationMessage({
          to: normalizedEmail,
          verificationUrl: getEmailVerificationUrl(env, verificationToken),
          expiresInMinutes: emailVerificationExpiresInMinutes,
          ign: auth.user.ign,
        }));

        const safeUser = getRepositories().users.toSafeUser(updatedUser || auth.user);
        const token = await signUserToken(safeUser, env);
        return json({
          success: true,
          data: safeUser,
          message: 'Email updated. Check your new inbox to verify it.',
        }, {
          headers: { 'set-cookie': setAuthCookie(token, env) },
        });
      } catch (error) {
        const duplicateMessage = duplicateAuthMessage(error);
        if (duplicateMessage) {
          return json({ success: false, message: duplicateMessage }, { status: 409 });
        }

        console.error('Error changing email:', error);
        return json({
          success: false,
          message: error.publicMessage || 'Failed to change email',
        }, { status: error.publicMessage ? 503 : 500 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/auth/change-password') {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const body = await readJson(request);
        const { error, value } = changePasswordSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        if (auth.user.password_hash) {
          const passwordMatches = await verifyPassword(value.currentPassword || '', auth.user.password_hash);
          if (!passwordMatches) {
            return json({
              success: false,
              message: 'Current password is incorrect.',
            }, { status: 401 });
          }
        }

        const updatedUser = await getRepositories().users.updatePassword(auth.user.id, await derivePasswordHash(value.newPassword));
        return json({
          success: true,
          data: getRepositories().users.toSafeUser(updatedUser || auth.user),
          message: auth.user.password_hash
            ? 'Password updated successfully.'
            : 'Password added successfully.',
        });
      } catch (error) {
        console.error('Error changing password:', error);
        return json({ success: false, message: 'Failed to change password' }, { status: 500 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/auth/verify-email') {
      const { error, value } = verifyEmailSchema.validate(Object.fromEntries(url.searchParams.entries()));
      if (error) {
        return Response.redirect(buildWebRedirect(env, '/auth', {
          error: 'That verification link is invalid or expired.',
        }), 302);
      }

      try {
        const tokenHash = await sha256Hex(value.token);
        const user = await getRepositories().users.findByEmailVerificationTokenHash(tokenHash);
        if (!user || isExpired(user.email_verification_expires_at)) {
          return Response.redirect(buildWebRedirect(env, '/auth', {
            error: 'That verification link is invalid or expired.',
          }), 302);
        }

        await getRepositories().users.markEmailVerified(user.id);
        return Response.redirect(buildWebRedirect(env, '/auth', {
          mode: 'login',
          status: 'email-verified',
        }), 302);
      } catch (error) {
        console.error('Error verifying email:', error);
        return Response.redirect(buildWebRedirect(env, '/auth', {
          error: 'Unable to verify your email.',
        }), 302);
      }
    }

    if (request.method === 'GET' && pathname === '/api/members') {
      try {
        const data = await getRepositories().members.findAll();
        return json({ success: true, data });
      } catch (error) {
        console.error('Error fetching members:', error);
        return json({ success: false, message: 'Failed to fetch team members' }, { status: 500 });
      }
    }

    let match = pathname.match(/^\/api\/members\/ign\/inactive\/(.+)$/);
    if (request.method === 'GET' && match) {
      try {
        const member = await getRepositories().members.findByIgnIncludingInactive(decodeURIComponent(match[1]));
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        if (member.is_active) {
          return json({ success: false, message: 'Team member is already active' }, { status: 400 });
        }
        return json({ success: true, data: member });
      } catch (error) {
        console.error('Error fetching member:', error);
        return json({ success: false, message: 'Failed to fetch team member' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/members\/ign\/(.+)$/);
    if (request.method === 'GET' && match) {
      try {
        const member = await getRepositories().members.findByIgn(decodeURIComponent(match[1]));
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        return json({ success: true, data: member });
      } catch (error) {
        console.error('Error fetching member:', error);
        return json({ success: false, message: 'Failed to fetch team member' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/members\/discord\/(.+)$/);
    if (request.method === 'GET' && match) {
      try {
        const member = await getRepositories().members.findByDiscordId(decodeURIComponent(match[1]));
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        return json({ success: true, data: member });
      } catch (error) {
        console.error('Error fetching member:', error);
        return json({ success: false, message: 'Failed to fetch team member' }, { status: 500 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/members') {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const body = await readJson(request);
        const { error, value } = memberSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const member = await getRepositories().members.create(value);
        return json({
          success: true,
          data: member,
          message: 'Team member created successfully',
        }, { status: 201 });
      } catch (error) {
        console.error('Error creating member:', error);
        if (error.code === '23505' || /UNIQUE constraint failed/i.test(error.message || '')) {
          return json({
            success: false,
            message: 'A member with this IGN or Discord ID already exists',
          }, { status: 409 });
        }
        return json({ success: false, message: 'Failed to create team member' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/members\/reactivate\/([^/]+)$/);
    if (request.method === 'PUT' && match) {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const member = await getRepositories().members.reactivate(match[1]);
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        return json({
          success: true,
          data: member,
          message: 'Team member reactivated successfully',
        });
      } catch (error) {
        console.error('Error reactivating member:', error);
        return json({ success: false, message: 'Failed to reactivate team member' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/members\/([^/]+)\/stats$/);
    if (request.method === 'GET' && match) {
      try {
        const stats = await getRepositories().members.getShinyStats(match[1]);
        return json({ success: true, data: stats });
      } catch (error) {
        console.error('Error fetching member stats:', error);
        return json({ success: false, message: 'Failed to fetch member statistics' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/members\/([^/]+)$/);
    if (request.method === 'GET' && match) {
      try {
        const member = await getRepositories().members.findById(match[1]);
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        return json({ success: true, data: member });
      } catch (error) {
        console.error('Error fetching member:', error);
        return json({ success: false, message: 'Failed to fetch team member' }, { status: 500 });
      }
    }

    if (request.method === 'PUT' && match) {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const body = await readJson(request);
        const { error, value } = updateMemberSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const member = await getRepositories().members.update(match[1], value);
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        return json({
          success: true,
          data: member,
          message: 'Team member updated successfully',
        });
      } catch (error) {
        console.error('Error updating member:', error);
        return json({ success: false, message: 'Failed to update team member' }, { status: 500 });
      }
    }

    if (request.method === 'DELETE' && match) {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const member = await getRepositories().members.delete(match[1]);
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        return json({
          success: true,
          message: 'Team member deactivated successfully',
        });
      } catch (error) {
        console.error('Error deleting member:', error);
        return json({ success: false, message: 'Failed to delete team member' }, { status: 500 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/shinies') {
      try {
        const data = await getRepositories().shinies.findAll(buildShinyFilters(url));
        return json({ success: true, data, count: data.length });
      } catch (error) {
        console.error('Error fetching shinies:', error);
        return json({ success: false, message: 'Failed to fetch team shinies' }, { status: 500 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/shinies/stats') {
      try {
        const data = await getRepositories().shinies.getStats();
        return json({ success: true, data });
      } catch (error) {
        console.error('Error fetching shiny stats:', error);
        return json({ success: false, message: 'Failed to fetch shiny statistics' }, { status: 500 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/shinies/leaderboard') {
      try {
        const limit = parseInt(url.searchParams.get('limit') || '10', 10);
        const data = await getRepositories().shinies.getTopTrainers(limit);
        return json({ success: true, data });
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return json({ success: false, message: 'Failed to fetch leaderboard' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/shinies\/([^/]+)$/);
    if (request.method === 'GET' && match) {
      try {
        const shiny = await getRepositories().shinies.findById(match[1]);
        if (!shiny) {
          return json({ success: false, message: 'Shiny not found' }, { status: 404 });
        }
        return json({ success: true, data: shiny });
      } catch (error) {
        console.error('Error fetching shiny:', error);
        return json({ success: false, message: 'Failed to fetch shiny' }, { status: 500 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/shinies') {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const body = await readJson(request);
        const { error, value } = shinySchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const shiny = await getRepositories().shinies.create(await enrichShinyPayloadWithVariants(value));
        return json({
          success: true,
          data: shiny,
          message: 'Shiny entry created successfully',
        }, { status: 201 });
      } catch (error) {
        console.error('Error creating shiny:', error);
        if (error.code === '23503' || /FOREIGN KEY constraint failed/i.test(error.message || '')) {
          return json({ success: false, message: 'Invalid trainer ID or Pokemon number' }, { status: 400 });
        }
        return json({ success: false, message: 'Failed to create shiny entry' }, { status: 500 });
      }
    }

    if (request.method === 'PUT' && match) {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const body = await readJson(request);
        const { error, value } = updateShinySchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const shiny = await getRepositories().shinies.update(match[1], await enrichShinyPayloadWithVariants(value));
        if (!shiny) {
          return json({ success: false, message: 'Shiny not found' }, { status: 404 });
        }
        return json({
          success: true,
          data: shiny,
          message: 'Shiny entry updated successfully',
        });
      } catch (error) {
        console.error('Error updating shiny:', error);
        return json({ success: false, message: 'Failed to update shiny entry' }, { status: 500 });
      }
    }

    if (request.method === 'DELETE' && match) {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const shiny = await getRepositories().shinies.delete(match[1]);
        if (!shiny) {
          return json({ success: false, message: 'Shiny not found' }, { status: 404 });
        }
        return json({
          success: true,
          data: shiny,
          message: 'Shiny entry deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting shiny:', error);
        return json({ success: false, message: 'Failed to delete shiny entry' }, { status: 500 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/catch-events') {
      try {
        const authenticatedUser = await getAuthenticatedUser(request, env, getRepositories());
        const ownerOnly = url.searchParams.get('owner') === 'me';

        if (ownerOnly && !authenticatedUser) {
          return json({ success: false, message: 'Not signed in.' }, { status: 401 });
        }

        const events = await getRepositories().catchEvents.listEvents({
          manageableByUserId: ownerOnly ? authenticatedUser.id : undefined,
          publishedOnly: url.searchParams.get('published') === 'true',
        });
        return json({ success: true, data: events });
      } catch (error) {
        console.error('Error listing catch events:', error);
        return json({ success: false, message: 'Failed to list catch events' }, { status: 500 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/catch-events') {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const body = await readJson(request);
        const { error, value } = catchEventCreateSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const event = await getRepositories().catchEvents.createEvent(auth.user, value);
        return json({ success: true, data: event, message: 'Catch event created successfully' }, { status: 201 });
      } catch (error) {
        console.error('Error creating catch event:', error);
        return json({ success: false, message: 'Failed to create catch event' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)$/);
    if (request.method === 'PUT' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const body = await readJson(request);
        const { error, value } = catchEventCreateSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const event = await getRepositories().catchEvents.updateEvent(match[1], auth.user.id, value);
        if (!event) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        return json({ success: true, data: event, message: 'Catch event updated successfully' });
      } catch (error) {
        console.error('Error updating catch event:', error);
        return json({ success: false, message: 'Failed to update catch event' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)$/);
    if (request.method === 'DELETE' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const event = await getRepositories().catchEvents.deleteEvent(match[1], auth.user.id);
        if (!event) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        return json({ success: true, data: event, message: 'Catch event deleted successfully' });
      } catch (error) {
        console.error('Error deleting catch event:', error);
        return json({ success: false, message: 'Failed to delete catch event' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)\/collaborators$/);
    if (request.method === 'GET' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const collaborators = await getRepositories().catchEvents.listCollaborators(match[1], auth.user.id);
        if (!collaborators) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        return json({ success: true, data: collaborators });
      } catch (error) {
        console.error('Error listing catch event collaborators:', error);
        return json({ success: false, message: 'Failed to list shared admins' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)\/collaborators$/);
    if (request.method === 'POST' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const body = await readJson(request);
        const { error, value } = catchEventCollaboratorSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        let user;
        try {
          user = await getRepositories().users.findByEmailOrIgn(value.identifier);
        } catch (lookupError) {
          if (lookupError.code === 'AMBIGUOUS_ACCOUNT_IDENTIFIER') {
            return json({ success: false, message: lookupError.message }, { status: 409 });
          }
          throw lookupError;
        }

        if (!user) {
          return json({ success: false, message: 'Team Soju account not found' }, { status: 404 });
        }

        const collaborators = await getRepositories().catchEvents.addCollaborator(match[1], auth.user.id, user);
        if (!collaborators) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        return json({ success: true, data: collaborators, message: 'Shared admin added successfully' }, { status: 201 });
      } catch (error) {
        if (error.code === 'SELF_COLLABORATOR') {
          return json({ success: false, message: error.message }, { status: 400 });
        }
        console.error('Error adding catch event collaborator:', error);
        return json({ success: false, message: 'Failed to add shared admin' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)\/collaborators\/([^/]+)$/);
    if (request.method === 'DELETE' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const collaborators = await getRepositories().catchEvents.removeCollaborator(
          match[1],
          auth.user.id,
          decodeURIComponent(match[2])
        );
        if (!collaborators) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        return json({ success: true, data: collaborators, message: 'Shared admin removed successfully' });
      } catch (error) {
        console.error('Error removing catch event collaborator:', error);
        return json({ success: false, message: 'Failed to remove shared admin' }, { status: 500 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/catch-events/ocr') {
      try {
        const body = await readJson(request);
        const { error, value } = catchEventOcrSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const data = await extractCatchEventScreenshotFields(env, value.screenshots, {
          locale: value.locale,
          timezone: value.timezone,
        });
        return json({ success: true, data });
      } catch (error) {
        if (error.statusCode !== 503) {
          console.error('Error reading catch event screenshots:', error);
        }
        return json({
          success: false,
          message: error.statusCode === 503
            ? error.message
            : 'Failed to read screenshots',
        }, { status: error.statusCode || 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/screenshots\/([^/]+)$/);
    if (request.method === 'GET' && match) {
      try {
        const screenshot = await getRepositories().catchEvents.getScreenshotById(match[1]);
        if (!screenshot) {
          return json({ success: false, message: 'Screenshot not found' }, { status: 404 });
        }
        if (!env.CATCH_EVENT_SCREENSHOTS) {
          return json({ success: false, message: 'Screenshot storage is not configured' }, { status: 503 });
        }

        const object = await env.CATCH_EVENT_SCREENSHOTS.get(screenshot.storageKey);
        if (!object) {
          return json({ success: false, message: 'Screenshot not found' }, { status: 404 });
        }

        return new Response(object.body, {
          headers: {
            'content-type': object.httpMetadata?.contentType || screenshot.contentType || 'application/octet-stream',
            'cache-control': 'private, max-age=60',
          },
        });
      } catch (error) {
        console.error('Error fetching catch event screenshot:', error);
        return json({ success: false, message: 'Failed to fetch screenshot' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)\/publish$/);
    if (request.method === 'POST' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const body = await readJson(request);
        const { error, value } = catchEventPublishSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const event = await getRepositories().catchEvents.setLeaderboardPublished(
          match[1],
          auth.user.id,
          value.isLeaderboardPublished
        );
        if (!event) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        return json({ success: true, data: event, message: 'Catch event updated successfully' });
      } catch (error) {
        console.error('Error publishing catch event leaderboard:', error);
        return json({ success: false, message: 'Failed to update catch event' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)\/submissions-closed$/);
    if (request.method === 'POST' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const body = await readJson(request);
        const { error, value } = catchEventSubmissionsClosedSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const event = await getRepositories().catchEvents.setSubmissionsClosed(
          match[1],
          auth.user.id,
          value.submissionsClosed
        );
        if (!event) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        return json({ success: true, data: event, message: 'Catch event updated successfully' });
      } catch (error) {
        console.error('Error updating catch event submissions:', error);
        return json({ success: false, message: 'Failed to update catch event submissions' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)\/auto-check$/);
    if (request.method === 'POST' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const body = await readJson(request);
        const { error, value } = catchEventAutoCheckSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const event = await getRepositories().catchEvents.setAutoCheckEnabled(
          match[1],
          auth.user.id,
          value.autoCheckEnabled
        );
        if (!event) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        return json({ success: true, data: event, message: 'Catch event updated successfully' });
      } catch (error) {
        console.error('Error updating catch event auto-check:', error);
        return json({ success: false, message: 'Failed to update catch event auto-check' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)\/submissions\/([^/]+)\/status$/);
    if (request.method === 'POST' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const body = await readJson(request);
        const { error, value } = catchEventSubmissionStatusSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const event = await getRepositories().catchEvents.updateSubmissionStatus(
          match[1],
          auth.user.id,
          match[2],
          value.status
        );
        return json({ success: true, data: event, message: 'Submission updated successfully' });
      } catch (error) {
        console.error('Error updating catch event submission:', error);
        return json({ success: false, message: 'Failed to update submission' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)\/submissions$/);
    if (request.method === 'POST' && match) {
      try {
        const event = await getRepositories().catchEvents.getEventById(match[1]);
        if (!event) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }
        if (event.submissionsClosed) {
          return json({ success: false, message: 'Submissions are closed for this event.' }, { status: 403 });
        }

        const body = await readJson(request);
        const { error, value } = catchEventSubmissionSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const submissionId = crypto.randomUUID();
        const screenshots = await storeCatchEventScreenshots(
          env,
          match[1],
          submissionId,
          value.screenshots,
          request.url
        );
        const result = await getRepositories().catchEvents.upsertSubmission(match[1], value, screenshots);

        return json({
          success: true,
          data: result.submission,
          replaced: result.replaced,
          message: result.replaced ? 'Submission replaced successfully' : 'Submission created successfully',
        }, { status: result.replaced ? 200 : 201 });
      } catch (error) {
        console.error('Error submitting catch event entry:', error);
        return json({
          success: false,
          message: error.statusCode === 503
            ? error.message
            : 'Failed to submit catch event entry',
        }, { status: error.statusCode || 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)$/);
    if (request.method === 'GET' && match) {
      try {
        const authenticatedUser = await getAuthenticatedUser(request, env, getRepositories());
        const event = await getRepositories().catchEvents.getEventById(match[1], {
          includeSubmissions: true,
        });
        if (!event) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        const access = authenticatedUser?.id && getRepositories().catchEvents.getEventAccess
          ? await getRepositories().catchEvents.getEventAccess(match[1], authenticatedUser.id)
          : {
              isOwner: Boolean(authenticatedUser?.id && authenticatedUser.id === event.ownerUserId),
              canManage: Boolean(authenticatedUser?.id && authenticatedUser.id === event.ownerUserId),
            };
        const isOwner = Boolean(access?.isOwner);
        const canManage = Boolean(access?.canManage);
        if (!event.isLeaderboardPublished && !canManage) {
          return json({
            success: true,
            data: {
              ...event,
              submissions: [],
              leaderboardHidden: true,
            },
          });
        }

        return json({
          success: true,
          data: isOwner
            ? await getRepositories().catchEvents.getEventById(match[1], {
                includeSubmissions: true,
                includeCollaborators: true,
              })
            : event,
        });
      } catch (error) {
        console.error('Error fetching catch event:', error);
        return json({ success: false, message: 'Failed to fetch catch event' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/feebas\/([^/]+)\/leaderboard$/);
    if (request.method === 'GET' && match) {
      try {
        getLocationConfig(match[1]);
        const leaderboardSortKeys = getRepositories().feebas.getLeaderboardSortOptions().map((option) => option.key);
        const leaderboardQuerySchema = Joi.object({
          limit: Joi.number().integer().min(1).max(50).optional(),
          sortBy: Joi.string().valid(...leaderboardSortKeys).optional(),
          sortDirection: Joi.string().valid('asc', 'desc').optional(),
        });
        const { error, value } = leaderboardQuerySchema.validate(Object.fromEntries(url.searchParams.entries()));

        if (error) {
          return json({
            success: false,
            message: 'Validation error',
            details: error.details,
          }, { status: 400 });
        }

        const authenticatedUser = await getAuthenticatedUser(request, env, getRepositories());
        const leaderboard = await getRepositories().feebas.getLeaderboard(match[1], {
          ...value,
          currentUserId: authenticatedUser?.id,
        });
        return json({
          success: true,
          data: leaderboard,
        });
      } catch (error) {
        if (error instanceof FeebasRuleError) {
          return json({ success: false, message: error.message }, { status: error.statusCode });
        }

        console.error('Error fetching Feebas leaderboard:', error);
        return json({ success: false, message: 'Failed to fetch Feebas leaderboard' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/feebas\/([^/]+)\/tiles\/([^/]+)$/);
    if (request.method === 'POST' && match) {
      try {
        getLocationConfig(match[1]);
        const body = await readJson(request);
        const { error, value } = updateFeebasTileSchema.validate(body);

        if (error) {
          return json({
            success: false,
            message: 'Validation error',
            details: error.details,
          }, { status: 400 });
        }

        const board = await getRepositories().feebas.updateTile(match[1], match[2], value, {
          includeLeaderboard: false,
        });
        await broadcastFeebasBoard(match[1], getRepositories(), env);
        return json({
          success: true,
          data: board,
          message: 'Feebas tile updated successfully',
        });
      } catch (error) {
        if (error instanceof FeebasRuleError) {
          return json({ success: false, message: error.message }, { status: error.statusCode });
        }

        console.error('Error updating Feebas tile:', error);
        return json({ success: false, message: 'Failed to update Feebas tile' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/feebas\/([^/]+)\/stream$/);
    if (request.method === 'GET' && match) {
      try {
        getLocationConfig(match[1]);
        const actorFingerprint = feebasActorFingerprintSchema.validate(url.searchParams.get('actorFingerprint') || undefined).value;

        if (!isWebSocketUpgrade(request)) {
          return webSocketUpgradeRequired();
        }

        const durableObject = getFeebasStreamDurableObject(env, match[1]);
        if (durableObject) {
          return durableObject.fetch(createFeebasStreamDurableObjectRequest('/stream', match[1], actorFingerprint, {
            method: 'GET',
            headers: request.headers,
          }));
        }

        const board = await getRepositories().feebas.getBoard(match[1], {
          actorFingerprint,
          includeLeaderboard: false,
        });

        return createFeebasSocketResponse(request, match[1], actorFingerprint, board);
      } catch (error) {
        if (error instanceof FeebasRuleError) {
          return json({ success: false, message: error.message }, { status: error.statusCode });
        }

        console.error('Error opening Feebas stream:', error);
        return json({ success: false, message: 'Failed to open Feebas stream' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/feebas\/([^/]+)\/reset$/);
    if (request.method === 'POST' && match) {
      if (env.NODE_ENV === 'production') {
        return json({
          success: false,
          message: 'Feebas board reset is not available in production',
        }, { status: 403 });
      }

      try {
        getLocationConfig(match[1]);
        const board = await getRepositories().feebas.resetBoard(match[1]);
        await broadcastFeebasBoard(match[1], getRepositories(), env);
        return json({
          success: true,
          data: board,
          message: 'Feebas board reset successfully',
        });
      } catch (error) {
        if (error instanceof FeebasRuleError) {
          return json({ success: false, message: error.message }, { status: error.statusCode });
        }

        console.error('Error resetting Feebas board:', error);
        return json({ success: false, message: 'Failed to reset Feebas board' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/feebas\/([^/]+)$/);
    if (request.method === 'GET' && match) {
      try {
        getLocationConfig(match[1]);
        const actorFingerprint = feebasActorFingerprintSchema.validate(url.searchParams.get('actorFingerprint') || undefined).value;
        const authenticatedUser = await getAuthenticatedUser(request, env, getRepositories());
        const board = await getRepositories().feebas.getBoard(match[1], {
          actorFingerprint,
          currentUserId: authenticatedUser?.id,
        });

        return json({
          success: true,
          data: board,
        });
      } catch (error) {
        if (error instanceof FeebasRuleError) {
          return json({ success: false, message: error.message }, { status: error.statusCode });
        }

        console.error('Error fetching Feebas board:', error);
        return json({ success: false, message: 'Failed to fetch Feebas board' }, { status: 500 });
      }
    }

    return json({
      success: false,
      message: 'Endpoint not found',
    }, { status: 404 });
  }

  return {
    async fetch(request, env = {}, ctx = {}) {
      console.log(`${new Date().toISOString()} - ${request.method} ${new URL(request.url).pathname}`);

      try {
        const response = await routeRequest(request, env, ctx);
        return withStandardHeaders(response, request, env);
      } catch (error) {
        console.error('Global error handler:', error);
        return withStandardHeaders(json({
          success: false,
          message: 'Internal server error',
          ...(env.NODE_ENV === 'development' && { error: error.message }),
        }, { status: 500 }), request, env);
      }
    },
  };
}

module.exports = {
  createWorkerApp,
  FeebasBoardStreamDurableObject,
  fetch: (...args) => createWorkerApp().fetch(...args),
};
