const {
  buildShinyFilters,
  enrichShinyPayloadWithVariants,
  memberSchema,
  shinySchema,
  updateMemberSchema,
  updateShinySchema,
} = require('../contracts');
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
} = require('../auth');
const { createRepositories } = require('../repositories');
const { buildCorsHeaders, empty, json, readJson, withStandardHeaders } = require('../http');
const { FeebasRuleError, getLocationConfig, getWeatherAreaLocationIds } = require('../../utils/feebas');
const { isIgnBlacklisted } = require('../../utils/ignModeration');
const {
  calculateCatchEventScore,
  getDateTimePartsInZone,
  getTimezoneOffsetMs,
  normalizeCatchEventText,
  pokemonNatures,
  validateCatchEventSubmissionPayload,
  zonedLocalDateTimeToUtc,
} = require('../models/catch-event');

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
const updateFeebasWeatherSchema = Joi.object({
  weather: Joi.string().valid('rainy', 'clear').required(),
  actorFingerprint: Joi.string().trim().min(8).max(120).required(),
  actorName: Joi.string().trim().allow('', null).max(40).optional(),
});
const feebasActorFingerprintSchema = Joi.string().trim().min(8).max(120).optional();
const feebasLastActivityIdSchema = Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER).optional();
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
  nature: Joi.string().trim().allow('').max(40).default(''),
  totalIv: Joi.number().integer().min(0).max(186).required(),
  catchLocal: Joi.string().trim().min(8).max(40).required(),
  timezone: Joi.string().trim().min(1).max(80).required(),
  region: Joi.string().valid('Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova').required(),
  route: Joi.string().trim().min(1).max(120).required(),
  catchUtc: Joi.string().trim().min(8).max(40).required(),
  score: Joi.number().integer().min(-999).max(1186).required(),
  status: Joi.string().valid('pending-verification', 'auto-checked').required(),
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
  eventStartLocal: Joi.string().trim().allow('', null).max(40),
  eventEndLocal: Joi.string().trim().allow('', null).max(40),
  eventTimezone: Joi.string().trim().allow('', null).max(80),
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
  status: Joi.string().valid('pending-verification', 'auto-checked', 'verified', 'rejected', 'disqualified').required(),
});
const catchEventSubmissionUpdateSchema = Joi.object({
  playerIgn: Joi.string().trim().min(1).max(50).required(),
  species: Joi.string().trim().min(1).max(80).required(),
  nature: Joi.string().trim().allow('').max(40).default(''),
  totalIv: Joi.number().integer().min(0).max(186).required(),
  catchLocal: Joi.string().trim().min(8).max(40).required(),
  timezone: Joi.string().trim().min(1).max(80).required(),
  region: Joi.string().valid('Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova').required(),
  route: Joi.string().trim().min(1).max(120).required(),
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

function extractAiContentText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => (typeof part === 'string' ? part : part?.text || ''))
    .filter(Boolean)
    .join('\n');
}

function extractAiResponseText(result) {
  if (!result) return '';
  if (typeof result === 'string') return result;

  const directText = [result.response, result.text, result.output_text]
    .find((value) => typeof value === 'string' && value.trim());
  if (directText) return directText;

  const contentText = extractAiContentText(result.content);
  if (contentText) return contentText;

  if (Array.isArray(result.choices)) {
    for (const choice of result.choices) {
      const choiceText = extractAiContentText(choice?.message?.content || choice?.text);
      if (choiceText) return choiceText;
    }
  }

  if (result.result && typeof result.result === 'object') {
    return extractAiResponseText(result.result);
  }
  if (typeof result.result === 'string') return result.result;
  return '';
}

function parseAiJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    const error = new Error('OCR returned an empty response.');
    error.code = 'AI_RESPONSE_FORMAT';
    error.retryable = true;
    throw error;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      const error = new Error('OCR response was not JSON.');
      error.code = 'AI_RESPONSE_FORMAT';
      error.retryable = true;
      throw error;
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      const error = new Error('OCR response contained invalid JSON.');
      error.code = 'AI_RESPONSE_FORMAT';
      error.retryable = true;
      throw error;
    }
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

function padDateTimePart(value, size = 2) {
  return String(value).padStart(size, '0');
}

function parseOcrYear(value) {
  const year = Number(value);
  return year < 100 ? 2000 + year : year;
}

function parseOcrHour(value, meridiem) {
  let hour = Number(value);
  const normalizedMeridiem = String(meridiem || '').toUpperCase();

  if (normalizedMeridiem === 'PM' && hour < 12) hour += 12;
  if (normalizedMeridiem === 'AM' && hour === 12) hour = 0;

  return hour;
}

function isValidOcrDateTime(year, month, day, hour, minute, second) {
  if (
    month < 1
    || month > 12
    || day < 1
    || day > 31
    || hour < 0
    || hour > 23
    || minute < 0
    || minute > 59
    || second < 0
    || second > 59
  ) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    && date.getUTCHours() === hour
    && date.getUTCMinutes() === minute
    && date.getUTCSeconds() === second;
}

function formatOcrLocalDateTime(year, month, day, hour, minute, second) {
  return [
    padDateTimePart(year, 4),
    '-',
    padDateTimePart(month),
    '-',
    padDateTimePart(day),
    'T',
    padDateTimePart(hour),
    ':',
    padDateTimePart(minute),
    ':',
    padDateTimePart(second),
  ].join('');
}

function buildOcrLocalDateTime(year, month, day, hour, minute, second, dateOrder) {
  if (!isValidOcrDateTime(year, month, day, hour, minute, second)) return null;

  return {
    value: formatOcrLocalDateTime(year, month, day, hour, minute, second),
    dateOrder,
  };
}

function isOcrCandidateInsideEventWindow(candidate, context = {}) {
  const eventStartLocal = cleanNullableString(context.eventStartLocal, 40);
  const eventEndLocal = cleanNullableString(context.eventEndLocal, 40);
  const eventTimezone = cleanNullableString(context.eventTimezone, 80);
  const catchTimezone = cleanNullableString(context.timezone, 80);
  if (!eventStartLocal || !eventEndLocal || !eventTimezone || !catchTimezone) return false;

  try {
    const catchUtc = zonedLocalDateTimeToUtc(candidate.value, catchTimezone);
    const startUtc = zonedLocalDateTimeToUtc(eventStartLocal, eventTimezone);
    const endUtc = zonedLocalDateTimeToUtc(eventEndLocal, eventTimezone);
    return catchUtc >= startUtc && catchUtc <= endUtc;
  } catch {
    return false;
  }
}

function chooseOcrDateCandidate(candidates, preferredOrder, context = {}) {
  const validCandidates = candidates.filter(Boolean);
  if (!validCandidates.length) return null;

  const eventWindowCandidate = validCandidates.find((candidate) => isOcrCandidateInsideEventWindow(candidate, context));
  if (eventWindowCandidate) {
    return { ...eventWindowCandidate, usedEventWindow: true };
  }

  const preferredCandidate = validCandidates.find((candidate) => candidate.dateOrder === preferredOrder);
  return preferredCandidate || (preferredOrder ? validCandidates[0] : null);
}

function normalizeOcrCatchLocal(value, dateOrder, context = {}) {
  const text = cleanNullableString(value, 40);
  if (!text) return null;
  const normalizedText = text.replace(/\s+/g, ' ');
  const meta = context.meta || {};

  const isoMatch = normalizedText.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (isoMatch) {
    const [, rawYear, rawMonth, rawDay, rawHour, rawMinute, rawSecond = '00', meridiem] = isoMatch;
    const candidate = buildOcrLocalDateTime(
      Number(rawYear),
      Number(rawMonth),
      Number(rawDay),
      parseOcrHour(rawHour, meridiem),
      Number(rawMinute),
      Number(rawSecond),
      'ymd'
    );
    if (candidate) meta.dateOrder = 'ymd';
    return candidate?.value || null;
  }

  const numericMatch = normalizedText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!numericMatch) return null;

  const [, rawFirst, rawSecondDate, rawYear, rawHour, rawMinute, rawSecond = '00', meridiem] = numericMatch;
  const first = Number(rawFirst);
  const secondDate = Number(rawSecondDate);
  const order = String(dateOrder || '').toLowerCase();
  const year = parseOcrYear(rawYear);
  const hour = parseOcrHour(rawHour, meridiem);
  const minute = Number(rawMinute);
  const second = Number(rawSecond);
  const mdyCandidate = buildOcrLocalDateTime(year, first, secondDate, hour, minute, second, 'mdy');
  const dmyCandidate = buildOcrLocalDateTime(year, secondDate, first, hour, minute, second, 'dmy');
  const isAmbiguous = first <= 12 && secondDate <= 12;
  const preferredSlashOrder = ['mdy', 'dmy'].includes(order) ? order : null;
  const inferredOrder = !isAmbiguous && first > 12 ? 'dmy' : !isAmbiguous && secondDate > 12 ? 'mdy' : preferredSlashOrder;
  const candidate = isAmbiguous
    ? chooseOcrDateCandidate([mdyCandidate, dmyCandidate], preferredSlashOrder, context)
    : chooseOcrDateCandidate([inferredOrder === 'dmy' ? dmyCandidate : mdyCandidate], inferredOrder, context);

  if (!candidate) return null;

  meta.dateOrder = candidate.dateOrder;
  meta.usedEventWindow = Boolean(candidate.usedEventWindow);
  meta.usedFallback = isAmbiguous && !context.explicitDateOrder;
  return candidate.value;
}

function normalizeCatchEventOcrResult(parsed, fallbackDateOrder = null, context = {}) {
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
  const dateMeta = {};
  const catchLocal = normalizeOcrCatchLocal(parsed?.catchLocal || parsed?.catchTime, dateOrder, {
    ...context,
    explicitDateOrder: Boolean(parsed?.dateOrder),
    meta: dateMeta,
  });
  if (dateMeta.usedFallback && fallbackDateOrder && cleanNullableString(parsed?.catchLocal || parsed?.catchTime, 40)) {
    warnings.push(`Date order inferred from browser settings as ${fallbackDateOrder.toUpperCase()}.`);
  }
  if (dateMeta.usedEventWindow) {
    warnings.push('Ambiguous date matched using the event time window.');
  }

  return {
    playerIgn: cleanNullableString(parsed?.playerIgn || parsed?.ot, 50),
    species: cleanNullableString(parsed?.species || parsed?.pokemon, 80),
    pokedexNumber: Number.isFinite(pokedexNumber) ? pokedexNumber : null,
    nature: cleanNullableString(parsed?.nature, 40),
    totalIv: Number.isFinite(totalIv) ? Math.max(0, Math.min(186, Math.round(totalIv))) : null,
    catchLocal,
    catchTimeText: cleanNullableString(parsed?.catchTimeText || parsed?.catchTime, 80),
    location: cleanNullableString(parsed?.location, 120),
    dateOrder: dateMeta.dateOrder || dateOrder,
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
    const aiCode = Number(body?.errors?.[0]?.code);
    error.statusCode = response.status >= 400 && response.status < 500 ? response.status : 502;
    error.aiCode = Number.isFinite(aiCode) ? aiCode : null;
    error.retryable = response.status === 408
      || (response.status === 429 && error.aiCode !== 3036)
      || response.status >= 500;
    throw error;
  }

  return body?.result ?? body;
}

async function runCatchEventOcrModelOnce(env, model, payload) {
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

function isRetryableAiError(error) {
  if (typeof error?.retryable === 'boolean') return error.retryable;
  if ([408, 429, 500, 502, 504].includes(Number(error?.statusCode))) return true;
  return /internal server error|out of capacity|temporar(?:y|ily)|network connection lost|daemonDown/i
    .test(String(error?.message || error || ''));
}

async function runCatchEventOcrModel(env, model, payload) {
  const retryDelays = [100, 300];

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      return await runCatchEventOcrModelOnce(env, model, payload);
    } catch (error) {
      if (!isRetryableAiError(error) || attempt === retryDelays.length) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
    }
  }

  throw new Error('Workers AI request failed after retries.');
}

async function extractCatchEventScreenshotFields(env, screenshots, context = {}) {
  const fallbackDateOrder = inferDateOrderFromLocaleTimezone(context.locale, context.timezone);
  const model = env.CATCH_EVENT_OCR_MODEL || '@cf/google/gemma-4-26b-a4b-it';
  const results = await Promise.all(screenshots.map(async (screenshot, index) => {
    const roleInstructions = {
      'nature-ot': 'Extract playerIgn from "OT:", species from "Name:", pokedexNumber from "Pokedex:", and nature from "Nature:" without bracketed stat modifiers.',
      ivs: 'Extract only totalIv: the first number in the "Total:" row, such as 134 from "134 / 186".',
      information: 'Extract only location and catch time. In text like "Met ... in ROUTE 116 on 6/6/26 7:48:21 PM", location is ROUTE 116 and the timestamp follows "on".',
    };
    const prompt = [
      'OCR the left panel of this PokeMMO summary screenshot. Ignore the right half.',
      roleInstructions[screenshot.role] || 'Extract only labeled catch-event fields visible in the left panel.',
      'Do not explain your work. Do not infer absent values. Use null for every unrequested or absent field.',
      'Return only one JSON object with keys playerIgn, species, pokedexNumber, nature, totalIv, catchLocal, catchTimeText, dateOrder, location, confidence, warnings.',
      'catchLocal must be YYYY-MM-DDTHH:mm:ss. dateOrder must be mdy, dmy, ymd, or null.',
      fallbackDateOrder ? `Use ${fallbackDateOrder} for an otherwise ambiguous numeric date.` : '',
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
      max_completion_tokens: 4096,
      reasoning_effort: 'none',
      response_format: { type: 'json_object' },
    });

    console.log('Catch event OCR model output:', JSON.stringify({
      screenshot: screenshot.name || `screenshot ${index + 1}`,
      role: screenshot.role || null,
      model,
      result,
    }, null, 2));

    const responseText = extractAiResponseText(result);
    if (!responseText.trim()) {
      const finishReason = result?.choices?.[0]?.finish_reason;
      const warning = finishReason === 'length'
        ? `OCR reached its completion limit before returning JSON for ${screenshot.name || `screenshot ${index + 1}`}.`
        : `No OCR response was returned for ${screenshot.name || `screenshot ${index + 1}`}.`;
      return normalizeCatchEventOcrResult({
        warnings: [warning],
      }, fallbackDateOrder, context);
    }

    return normalizeCatchEventOcrResult(parseAiJson(responseText), fallbackDateOrder, context);
  }));

  return mergeCatchEventOcrResults(results);
}

async function storeCatchEventScreenshots(env, eventId, submissionId, screenshots, requestUrl) {
  if (!screenshots.length) return [];
  const screenshotStorage = env.SCREENSHOT_STORAGE;
  if (!screenshotStorage) {
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

    await screenshotStorage.put(storageKey, parsed.bytes, {
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

function createFeebasStreamDurableObjectRequest(pathname, location, actorFingerprint, init = {}, options = {}) {
  const url = new URL(`https://feebas-board-stream.local${pathname}`);
  url.searchParams.set('location', location);

  if (actorFingerprint) {
    url.searchParams.set('actorFingerprint', actorFingerprint);
  }

  if (typeof options.lastActivityId === 'number') {
    url.searchParams.set('lastActivityId', String(options.lastActivityId));
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


module.exports = {
  buildShinyFilters,
  enrichShinyPayloadWithVariants,
  memberSchema,
  shinySchema,
  updateMemberSchema,
  updateShinySchema,
  Joi,
  authenticateBotRequest,
  clearAuthCookie,
  generateBotToken,
  getTokenFromRequest,
  setAuthCookie,
  signJwt,
  signUserToken,
  verifyJwt,
  verifyUserToken,
  createRepositories,
  buildCorsHeaders,
  empty,
  json,
  readJson,
  withStandardHeaders,
  FeebasRuleError,
  getLocationConfig,
  getWeatherAreaLocationIds,
  isIgnBlacklisted,
  passwordResetExpiresInMinutes,
  passwordResetSentMessage,
  emailVerificationExpiresInMinutes,
  emailVerificationSentMessage,
  discordScopes,
  passwordMigrationMessage,
  discordHandoffTokenType,
  discordHandoffExpiresIn,
  discordHandoffHashParam,
  updateFeebasTileSchema,
  updateFeebasWeatherSchema,
  feebasActorFingerprintSchema,
  feebasLastActivityIdSchema,
  passwordSchema,
  forgotPasswordSchema,
  registerSchema,
  loginSchema,
  resetPasswordSchema,
  changeEmailSchema,
  changePasswordSchema,
  verifyEmailSchema,
  discordStartSchema,
  discordSessionSchema,
  catchEventRuleSchema,
  catchEventCreateSchema,
  catchEventSubmissionSchema,
  catchEventOcrSchema,
  catchEventPublishSchema,
  catchEventSubmissionsClosedSchema,
  catchEventAutoCheckSchema,
  catchEventSubmissionStatusSchema,
  catchEventSubmissionUpdateSchema,
  catchEventCollaboratorSchema,
  pokemonNatures,
  normalizeCatchEventText,
  getDateTimePartsInZone,
  getTimezoneOffsetMs,
  zonedLocalDateTimeToUtc,
  calculateCatchEventScore,
  validateCatchEventSubmissionPayload,
  getEnvUrl,
  getWebAppUrl,
  getApiOrigin,
  getDiscordRedirectUri,
  getDiscordConfig,
  getEmailVerificationUrl,
  getPasswordResetUrl,
  buildWebRedirect,
  buildDiscordHandoffRedirect,
  redirect,
  sanitizeReturnTo,
  getDiscordScopeParam,
  getBlacklistedIgnMessage,
  buildState,
  verifyState,
  buildDiscordHandoffToken,
  verifyDiscordHandoffToken,
  escapeHtml,
  parseScreenshotDataUrl,
  sanitizeFileName,
  extractAiResponseText,
  parseAiJson,
  cleanNullableString,
  inferDateOrderFromLocaleTimezone,
  normalizeOcrCatchLocal,
  normalizeCatchEventOcrResult,
  mergeCatchEventOcrResults,
  isLocalAiBindingError,
  getCloudflareAiRestConfig,
  createLocalAiConfigError,
  runCloudflareAiRest,
  runCatchEventOcrModel,
  extractCatchEventScreenshotFields,
  storeCatchEventScreenshots,
  buildPasswordResetMessage,
  buildEmailVerificationMessage,
  sendEmail,
  exchangeDiscordCode,
  fetchDiscordUser,
  getCrypto,
  randomHex,
  sha256Hex,
  derivePasswordHash,
  verifyPassword,
  isExpired,
  duplicateAuthMessage,
  isLocalhost,
  shouldNormalizeLegacyCookie,
  normalizeLegacySetCookie,
  encodeFeebasSocketMessage,
  createFeebasStreamDurableObjectRequest,
  isWebSocketUpgrade,
  webSocketUpgradeRequired,
  createWebSocketPair,
  createWebSocketUpgradeResponse,
  serializeFeebasSocketMetadata,
  deserializeFeebasSocketMetadata,
  sendFeebasSocketBoard,
  getFeebasStreamDurableObject,
};
