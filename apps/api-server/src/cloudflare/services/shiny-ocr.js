const { getPokemonVariants } = require('@team-soju/utils');
const { shinyScreenshotJobSchema } = require('../contracts/shiny-ocr');
const {
  extractAiResponseText,
  parseAiJson,
  runCatchEventOcrModel,
} = require('./worker-support');
const { inferDateOrderFromLocale } = require('./date-order');
const { buildErrorPayload, buildExtractedFields, buildSuccessPayload } = require('./shiny-ocr-format');
const { parseShinyOcrDate } = require('./shiny-ocr-date');
const { getFallbackLocalDate, localCatchDateTimeToUtc } = require('../../utils/shinyCatchTime');

const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ALLOWED_DISCORD_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);
const EARLIEST_TRACKER_DATE = '2025-07-11';
const OCR_TRAINER_BLACKLISTED_CHARACTERS = /!/g;

function getStorage(env) {
  return env.SCREENSHOT_STORAGE;
}

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function firstRow(env, sql, values = []) {
  return env.DB.prepare(sql).bind(...values).first();
}

async function run(env, sql, values = []) {
  return env.DB.prepare(sql).bind(...values).run();
}

function parseJob(row) {
  if (!row) return null;
  return {
    ...row,
    request: JSON.parse(row.request_payload),
    callbackPayload: row.callback_payload ? JSON.parse(row.callback_payload) : null,
  };
}

async function findJob(env, jobId) {
  return parseJob(await firstRow(env, 'SELECT * FROM shiny_screenshot_jobs WHERE id = ?', [jobId]));
}

async function findJobByInteraction(env, interactionId) {
  return parseJob(await firstRow(env, 'SELECT * FROM shiny_screenshot_jobs WHERE interaction_id = ?', [interactionId]));
}

async function updateJob(env, jobId, fields) {
  const entries = Object.entries(fields);
  if (!entries.length) return;
  await run(env, `UPDATE shiny_screenshot_jobs SET ${entries.map(([key]) => `${key} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`, [
    ...entries.map(([, value]) => value),
    jobId,
  ]);
}

function validateScreenshotUrl(value) {
  const url = new URL(value);
  if (!ALLOWED_DISCORD_HOSTS.has(url.hostname.toLowerCase())) {
    const error = new Error('Screenshot must be hosted by Discord.');
    error.status = 400;
    throw error;
  }
  return url;
}

async function downloadScreenshot(fetchImpl, screenshotUrl) {
  validateScreenshotUrl(screenshotUrl);
  const response = await fetchImpl(screenshotUrl);
  if (!response.ok) {
    const error = new Error('Failed to download screenshot from Discord.');
    error.status = 400;
    throw error;
  }
  const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    const error = new Error('Screenshot must be a PNG, JPEG, or WebP image.');
    error.status = 400;
    throw error;
  }
  if (contentLength > MAX_SCREENSHOT_BYTES) {
    const error = new Error('Screenshot must be 10 MiB or smaller.');
    error.status = 413;
    throw error;
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_SCREENSHOT_BYTES) {
    const error = new Error('Screenshot must be 10 MiB or smaller.');
    error.status = 413;
    throw error;
  }
  return { bytes, contentType };
}

async function enqueueShinyScreenshotJob({ request, env, fetchImpl, body }) {
  const { error, value } = shinyScreenshotJobSchema.validate(body);
  if (error) {
    const validationError = new Error('Validation error');
    validationError.status = 400;
    validationError.details = error.details;
    throw validationError;
  }
  if (!env.DB || !env.SHINY_OCR_QUEUE || !getStorage(env)) {
    const configError = new Error('Screenshot OCR storage, database, or Queue is not configured.');
    configError.status = 503;
    throw configError;
  }

  const existing = await findJobByInteraction(env, value.discord_interaction_id);
  if (existing) return existing;

  const jobId = `ss-${value.discord_interaction_id}`;
  const publicToken = randomToken();
  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
  const screenshot = await downloadScreenshot(fetchImpl, value.screenshot_url);
  const storageKey = `shiny-ocr/${jobId}-${publicToken}.${extension[screenshot.contentType]}`;
  await getStorage(env).put(storageKey, screenshot.bytes, { httpMetadata: { contentType: screenshot.contentType } });

  const origin = new URL(request.url).origin;
  const payload = {
    ...value,
    screenshot_url: `${origin}/api/shinies/screenshots/${jobId}/${publicToken}`,
  };
  try {
    await run(env, `
      INSERT INTO shiny_screenshot_jobs (
        id, interaction_id, status, storage_key, public_token, request_payload
      ) VALUES (?, ?, 'queued', ?, ?, ?)
    `, [jobId, value.discord_interaction_id, storageKey, publicToken, JSON.stringify(payload)]);
    await env.SHINY_OCR_QUEUE.send({ jobId });
  } catch (queueError) {
    await getStorage(env).delete(storageKey);
    await run(env, 'DELETE FROM shiny_screenshot_jobs WHERE id = ?', [jobId]).catch(() => {});
    throw queueError;
  }
  return findJob(env, jobId);
}

function normalizeText(value, maxLength) {
  const text = String(value || '').trim();
  return text && !['null', 'unknown'].includes(text.toLowerCase()) ? text.slice(0, maxLength) : null;
}

function normalizeOcrPokemonName(value) {
  const pokemon = normalizeText(value, 50);
  if (!pokemon) return null;

  const normalized = pokemon.toLowerCase().replace(/\s+/g, '');
  if (normalized === 'nidoran♀') return 'nidoran-f';
  if (normalized === 'nidoran♂') return 'nidoran-m';
  return pokemon;
}

function normalizeOcrTrainer(value) {
  const trainer = normalizeText(value, 50);
  if (!trainer) return null;
  return trainer.replace(OCR_TRAINER_BLACKLISTED_CHARACTERS, '').trim() || null;
}

function normalizeInteger(value, minimum, maximum) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : null;
}

function latestToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Kiritimati', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function normalizeOcrResult(raw, jobRequest) {
  const ivSource = Array.isArray(raw?.ivs) ? raw.ivs : [raw?.ivHp, raw?.ivAttack, raw?.ivDefense, raw?.ivSpAttack, raw?.ivSpDefense, raw?.ivSpeed];
  const rawCatchDate = normalizeText(raw?.rawCatchDate || raw?.catchDateText, 20);
  const requestedDateOrder = jobRequest.date_order || 'auto';
  const preferredDateOrder = requestedDateOrder === 'auto'
    ? inferDateOrderFromLocale(jobRequest.locale)
    : requestedDateOrder;
  const normalizedDate = parseShinyOcrDate(rawCatchDate || raw?.catchDate || raw?.date, preferredDateOrder);
  const parsed = {
    pokemon: normalizeOcrPokemonName(raw?.pokemon || raw?.name),
    trainer: normalizeOcrTrainer(raw?.trainer || raw?.originalTrainer || raw?.ot),
    catchDate: normalizedDate.catchDate,
    catchTime: normalizeText(raw?.catchTime || raw?.time, 5),
    dateAmbiguous: normalizedDate.dateAmbiguous,
    nature: normalizeText(raw?.nature, 20),
    totalEncounters: normalizeInteger(raw?.totalEncounters, 0, Number.MAX_SAFE_INTEGER),
    speciesEncounters: normalizeInteger(raw?.speciesEncounters, 0, Number.MAX_SAFE_INTEGER),
    ivs: ivSource.map((value) => normalizeInteger(value, 0, 31)),
  };
  const notes = Array.isArray(raw?.warnings) ? raw.warnings.map((item) => normalizeText(item, 300)).filter(Boolean) : [];
  if (normalizedDate.usedPreferredOrder) {
    const basis = requestedDateOrder === 'auto'
      ? `Discord locale (${jobRequest.locale})`
      : `the requested ${requestedDateOrder.toUpperCase()} date order`;
    notes.push(`The screenshot date "${rawCatchDate}" can use multiple date orders. It was interpreted as ${normalizedDate.dateOrder.toUpperCase()} using ${basis}. Select **Edit** > **Catch Date** to change.`);
  } else if (parsed.dateAmbiguous || (!rawCatchDate && raw?.dateAmbiguous)) {
    parsed.catchDate = getFallbackLocalDate(jobRequest.command_called_at, jobRequest.timezone);
    notes.push(`Ambiguous date was found in screenshot. The caught date was set to today's date (${parsed.catchDate}), instead. Select **Edit** > **Catch Date** to change.`);
  }
  if (parsed.catchDate && parsed.catchDate < EARLIEST_TRACKER_DATE) {
    notes.push(`The date was read as ${parsed.catchDate}, which is before ${EARLIEST_TRACKER_DATE}. Please double-check the date with **Edit** > **Catch Date**.`);
  }
  if (parsed.catchDate && parsed.catchDate > latestToday()) {
    const fallback = getFallbackLocalDate(jobRequest.command_called_at, jobRequest.timezone);
    notes.push(`The date was read as ${parsed.catchDate}, which is in the future. It was set to today's date (${fallback}) instead. Select **Edit** > **Catch Date** to change.`);
    parsed.catchDate = fallback;
  }
  if (!parsed.pokemon || !parsed.trainer || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.catchDate || '') || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(parsed.catchTime || '')) {
    const error = new Error('OCR validation failed: Pokémon, trainer, date, or time is missing or invalid.');
    error.status = 422;
    error.ocrText = JSON.stringify(raw);
    throw error;
  }
  if (notes.length) console.log('Shiny OCR output with warnings:', JSON.stringify(raw));
  return { parsed, notes };
}

async function extractScreenshotFields(env, object, request) {
  const bytes = await object.arrayBuffer();
  const contentType = object.httpMetadata?.contentType || 'image/png';
  const base64 = Buffer.from(bytes).toString('base64');
  const model = env.SHINY_OCR_MODEL || '@cf/google/gemma-4-26b-a4b-it';
  const prompt = [
    'Read this PokeMMO shiny Encounter Tracker screenshot.',
    'Extract the shiny Pokemon name, trainer/OT, catch date, local catch time, nature, six IVs in HP/Atk/Def/SpA/SpD/Spe order, total encounters, and species encounters.',
    'Do not infer absent values. Return rawCatchDate as only the visible date token (for example, 8/18/26), preserving its order and separators but excluding the following comma and time.',
    'Return only JSON with keys pokemon, trainer, rawCatchDate, catchTime, nature, ivs, totalEncounters, speciesEncounters, warnings.',
    'catchTime is 24-hour HH:mm. Code will validate and interpret rawCatchDate.',
  ].join('\n');
  const result = await runCatchEventOcrModel(env, model, {
    messages: [{ role: 'user', content: [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: `data:${contentType};base64,${base64}` } },
    ] }],
    temperature: 0,
    max_completion_tokens: 4096,
    chat_template_kwargs: { enable_thinking: false },
    response_format: { type: 'json_object' },
  });
  const responseText = extractAiResponseText(result);
  if (!responseText) {
    console.warn('Empty shiny OCR response:', {
      model,
      finishReason: result?.choices?.[0]?.finish_reason,
      usage: result?.usage,
      responseType: typeof result?.response,
      responseKeys: result && typeof result === 'object' ? Object.keys(result) : [],
    });
    throw new Error('Workers AI returned an empty OCR response.');
  }
  return normalizeOcrResult(parseAiJson(responseText), request);
}

function normalizeIgn(value) {
  return String(value || '').trim().toLowerCase().replace(/[|!1il]/g, 'l');
}

async function resolveTrainer(repositories, parsed, request) {
  const member = await repositories.members.findByDiscordId(request.discord_user_id);
  const hasMemberRole = request.member_roles.includes('Soju');
  const hasStaffRole = request.member_roles.includes('Elite 4') || request.member_roles.includes('Champion');
  if (hasMemberRole && !hasStaffRole && (!member || normalizeIgn(member.ign) !== normalizeIgn(parsed.trainer))) {
    const error = new Error(member ? `You can only manage shinies for your registered IGN: ${member.ign}` : 'Your Discord account is not registered in the member database.');
    error.status = 403;
    throw error;
  }
  const exact = await repositories.members.findByIgn(parsed.trainer);
  if (exact) return exact;
  const matches = (await repositories.members.findAll()).filter((entry) => normalizeIgn(entry.ign) === normalizeIgn(parsed.trainer));
  if (matches.length === 1) return matches[0];
  const error = new Error(`Could not find trainer with IGN "${parsed.trainer}"`);
  error.status = 404;
  throw error;
}

async function createShinyFromJob(env, job, repositories) {
  const object = await getStorage(env).get(job.storage_key);
  if (!object) throw new Error('Queued screenshot was not found in R2.');
  const { parsed, notes } = await extractScreenshotFields(env, object, job.request);
  const trainer = await resolveTrainer(repositories, parsed, job.request);
  const variants = await getPokemonVariants(parsed.pokemon);
  if (!variants?.national_number) {
    const error = new Error(`Could not find national number for Pokémon "${parsed.pokemon}"`);
    error.status = 404;
    throw error;
  }
  const variant = String(parsed.pokemon).trim().toLowerCase();
  const pokemon = ['nidoran-f', 'nidoran-m'].includes(variant) ? 'nidoran' : (variants.species || variant);
  const existingShiny = typeof repositories.shinies.findById === 'function'
    ? await repositories.shinies.findById(job.id)
    : null;
  const shiny = existingShiny || await repositories.shinies.create({
    id: job.id,
    national_number: variants.national_number,
    pokemon,
    variants: ['nidoran-f', 'nidoran-m'].includes(variant) ? 'nidoran' : variant,
    original_trainer: trainer.id,
    catch_date: parsed.catchDate,
    caught_at_utc: localCatchDateTimeToUtc(parsed.catchDate, parsed.catchTime, job.request.timezone),
    catch_timezone: job.request.timezone,
    encounter_type: job.request.encounter_type,
    is_secret: job.request.is_secret,
    is_alpha: job.request.is_alpha,
    screenshot_url: job.request.screenshot_url,
    total_encounters: parsed.totalEncounters || 0,
    species_encounters: parsed.speciesEncounters || 0,
    ...(parsed.nature ? { nature: parsed.nature } : {}),
    ...Object.fromEntries(['iv_hp', 'iv_attack', 'iv_defense', 'iv_sp_attack', 'iv_sp_defense', 'iv_speed']
      .map((key, index) => [key, parsed.ivs[index]]).filter(([, value]) => Number.isInteger(value))),
  });
  return buildSuccessPayload(shiny, notes, buildExtractedFields(parsed, job.request.timezone));
}

async function callback(env, request, payload, fetchImpl = fetch) {
  if (!env.SCREENSHOT_RESULT_CALLBACK_SECRET) throw new Error('Screenshot callback secret is not configured.');
  const body = JSON.stringify({
    application_id: request.discord_application_id,
    interaction_token: request.discord_interaction_token,
    payload,
  });
  const timestamp = String(Date.now());
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SCREENSHOT_RESULT_CALLBACK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`));
  const signature = Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const response = await fetchImpl(request.callback_url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-soju-timestamp': timestamp, 'x-soju-signature': signature },
    body,
  });
  if (!response.ok) throw new Error(`Screenshot callback failed (${response.status}): ${await response.text()}`);
}

async function processShinyOcrJob(env, jobId, repositories, fetchImpl = fetch) {
  let job = await findJob(env, jobId);
  if (!job || ['completed', 'failed'].includes(job.status)) return;
  if (job.callbackPayload) {
    await callback(env, job.request, job.callbackPayload, fetchImpl);
    await updateJob(env, job.id, { status: 'completed', completed_at: new Date().toISOString() });
    return;
  }
  await updateJob(env, job.id, { status: 'processing', attempts: Number(job.attempts || 0) + 1 });
  job = await findJob(env, jobId);
  const payload = await createShinyFromJob(env, job, repositories);
  await updateJob(env, job.id, { status: 'callback_pending', callback_payload: JSON.stringify(payload) });
  await callback(env, job.request, payload, fetchImpl);
  await updateJob(env, job.id, { status: 'completed', completed_at: new Date().toISOString() });
}

async function failShinyOcrJob(env, jobId, error, fetchImpl = fetch) {
  const job = await findJob(env, jobId);
  if (!job) return;
  if (job.callbackPayload) {
    await updateJob(env, job.id, {
      status: 'failed', error_message: `Callback delivery failed: ${String(error.message || error)}`, completed_at: new Date().toISOString(),
    });
    return;
  }
  const payload = buildErrorPayload(error);
  await updateJob(env, job.id, {
    status: 'failed', callback_payload: JSON.stringify(payload), error_message: String(error.message || error), completed_at: new Date().toISOString(),
  });
  await callback(env, job.request, payload, fetchImpl);
  await getStorage(env).delete(job.storage_key);
}

async function getShinyScreenshot(env, jobId, token) {
  if (!env.DB || !getStorage(env)) return null;
  const job = await firstRow(
    env,
    "SELECT storage_key FROM shiny_screenshot_jobs WHERE id = ? AND public_token = ? AND status IN ('callback_pending', 'completed')",
    [jobId, token]
  );
  if (!job) return null;
  return getStorage(env).get(job.storage_key);
}

module.exports = {
  enqueueShinyScreenshotJob,
  failShinyOcrJob,
  getShinyScreenshot,
  getStorage,
  normalizeOcrResult,
  processShinyOcrJob,
};
