const express = require('express');
const fs = require('fs');
const Joi = require('joi');
const path = require('path');
const { capitalize, getNationalNumber, getSpriteUrl, greyscale, getPokemonVariants } = require('@team-soju/utils');
const TeamShiny = require('../models/TeamShiny');
const TeamMember = require('../models/TeamMember');
const { parseMobileStatsPanel } = require('../utils/mobileStatsParser');
const router = express.Router();
const { authenticateBot } = require('../middleware/auth');

const NATURE_CHOICES = [
  'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
  'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
  'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
  'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
  'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky',
];

const ENCOUNTER_TYPE_CHOICES = [
  'single',
  'x5_horde',
  'x3_horde',
  'horde',
  'safari',
  'fishing',
  'egg',
  'mysterious_ball',
  'honey_tree',
  'rock_smash',
  'swarm',
  'fossil',
  'headbutt',
  'gift',
];

const SHINY_STATUS_CHOICES = ['Owned', 'Sold', 'Fled', 'Died', 'Bred'];

function normalizeVariantName(value) {
  return String(value || '').trim().toLowerCase();
}

async function enrichShinyPayloadWithVariants(payload) {
  const hasPokemon = Boolean(payload?.pokemon);
  const pokemon = hasPokemon ? normalizeVariantName(payload.pokemon) : undefined;
  const hasExplicitVariant = Object.prototype.hasOwnProperty.call(payload || {}, 'variants');
  const normalizedVariant = hasExplicitVariant ? normalizeVariantName(payload.variants) : null;

  const nextPayload = {
    ...payload,
    ...(hasPokemon ? { pokemon } : {}),
    ...(hasExplicitVariant ? { variants: normalizedVariant } : {}),
  };

  if (!hasPokemon) {
    return nextPayload;
  }

  const variantData = await getPokemonVariants(pokemon);

  return {
    ...nextPayload,
    variants: normalizedVariant || pokemon,
    national_number: nextPayload.national_number ?? variantData?.national_number ?? null,
  };
}

function loadOcrDependencies() {
  try {
    return {
      sharp: require('sharp'),
      Tesseract: require('tesseract.js'),
    };
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      error.message = `OCR dependency missing: ${error.message}`;
    }
    throw error;
  }
}

async function createOcrWorker(Tesseract) {
  if (typeof Tesseract?.createWorker !== 'function') {
    return null;
  }

  const localOcrDataRoot = path.resolve(__dirname, '../..');
  const localEnglishData = path.join(localOcrDataRoot, 'eng.traineddata');
  const workerOptions = fs.existsSync(localEnglishData)
    ? {
      gzip: false,
      langPath: localOcrDataRoot,
    }
    : {};

  return Tesseract.createWorker('eng', 1, workerOptions);
}

function formatMobileStatsLog(mobileStats) {
  if (!mobileStats) {
    return 'Mobile Stats Parser\n  No parser output';
  }

  const recognizers = mobileStats.meta?.recognizers;
  const summary = {
    confidence: mobileStats.confidence,
    values: {
      ivs: [mobileStats.hp, mobileStats.atk, mobileStats.def, mobileStats.spa, mobileStats.spd, mobileStats.spe],
      nature: mobileStats.nature,
      totalEncounters: mobileStats.totalEncounters,
      speciesEncounters: mobileStats.speciesEncounters,
    },
    recognizers: recognizers ? {
      ivs: {
        value: recognizers.ivs?.value,
        confidence: recognizers.ivs?.confidence,
        strategy: recognizers.ivs?.strategy,
        raw: recognizers.ivs?.raw,
        variant: recognizers.ivs?.variant,
      },
      nature: {
        value: recognizers.nature?.value,
        confidence: recognizers.nature?.confidence,
        strategy: recognizers.nature?.strategy,
        raw: recognizers.nature?.raw,
        variant: recognizers.nature?.variant,
      },
      totalEncounters: {
        value: recognizers.totalEncounters?.value,
        confidence: recognizers.totalEncounters?.confidence,
        strategy: recognizers.totalEncounters?.strategy,
        raw: recognizers.totalEncounters?.raw,
        variant: recognizers.totalEncounters?.variant,
        candidates: recognizers.totalEncounters?.debugCandidates,
      },
      speciesEncounters: {
        value: recognizers.speciesEncounters?.value,
        confidence: recognizers.speciesEncounters?.confidence,
        strategy: recognizers.speciesEncounters?.strategy,
        raw: recognizers.speciesEncounters?.raw,
        variant: recognizers.speciesEncounters?.variant,
        candidates: recognizers.speciesEncounters?.debugCandidates,
      },
    } : null,
  };

  return `Mobile Stats Parser\n${JSON.stringify(summary, null, 2)}`;
}

const SCREENSHOT_JOB_STATUS = {
  queued: 'queued',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed',
};

const screenshotJobs = [];
let screenshotQueueActive = false;
let screenshotJobCounter = 0;

function createScreenshotJobId() {
  screenshotJobCounter += 1;
  return `ss-${Date.now()}-${screenshotJobCounter}`;
}

function formatEncounterType(encounterType) {
  return ({
    x5_horde: '5x Horde',
    x3_horde: '3x Horde',
    horde: 'Horde',
    mysterious_ball: 'Mysterious Ball',
    honey_tree: 'Honey Tree',
    rock_smash: 'Rock Smash',
  }[encounterType] || capitalize(String(encounterType || '').replace(/_/g, ' ')));
}

function buildShinyActionComponents(shinyId) {
  if (!shinyId) return [];

  return [{
    type: 1,
    components: [
      { type: 2, custom_id: `sh:a:v:a:_:1:10:${shinyId}`, label: 'View', style: 2 },
      { type: 2, custom_id: `sh:a:e:a:_:1:10:${shinyId}`, label: 'Edit', style: 1 },
      { type: 2, custom_id: `sh:a:d:a:_:1:10:${shinyId}`, label: 'Delete', style: 4 },
    ],
  }];
}

function buildAsyncScreenshotSuccessPayload(shiny, notes = []) {
  const normalizedNotes = notes.filter(Boolean);

  return {
    ...(normalizedNotes.length > 0 ? { content: normalizedNotes.join('\n') } : {}),
    embeds: [{
      color: shiny.is_secret ? 0xFFD700 : 0x4CAF50,
      title: `${shiny.is_secret ? 'Secret ' : ''}Shiny Added!`,
      image: shiny.screenshot_url ? { url: shiny.screenshot_url } : undefined,
      fields: [
        { name: 'Trainer', value: shiny.trainer_name, inline: true },
        { name: 'Pokemon', value: `${capitalize(shiny.pokemon)} (#${shiny.national_number})`, inline: true },
        { name: 'Encounter Type', value: formatEncounterType(shiny.encounter_type), inline: true },
        { name: 'Encounters', value: String(shiny.total_encounters || 0), inline: true },
      ],
      footer: { text: `Shiny ID: ${shiny.id}` },
      timestamp: new Date().toISOString(),
    }],
    components: buildShinyActionComponents(shiny.id),
  };
}

function buildAsyncScreenshotErrorPayload(error) {
  const ocrText = error?.details?.ocr_text;
  const details = ocrText ? `\nOCR result:\n\`\`\`\n${ocrText}\n\`\`\`` : '';
  return {
    content: `Error: ${error?.message || 'Failed to create shiny entry from screenshot'}${details}`,
  };
}

async function signScreenshotCallbackPayload(secret, timestamp, body) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`));
  return Buffer.from(signature).toString('hex');
}

async function notifyScreenshotCallback(callbackUrl, payload) {
  const secret = process.env.SCREENSHOT_RESULT_CALLBACK_SECRET;
  if (!secret) {
    throw new Error('SCREENSHOT_RESULT_CALLBACK_SECRET is required to deliver async screenshot results.');
  }

  const timestamp = String(Date.now());
  const body = JSON.stringify(payload);
  const signature = await signScreenshotCallbackPayload(secret, timestamp, body);
  const response = await fetch(callbackUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-soju-timestamp': timestamp,
      'x-soju-signature': signature,
    },
    body,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Screenshot callback failed (${response.status}): ${body}`);
  }
}

// Validation schema
const shinySchema = Joi.object({
  national_number: Joi.number().integer().min(1).max(1010).required(),
  pokemon: Joi.string().max(50).required(),
  variants: Joi.string().trim().lowercase().max(50).optional(),
  original_trainer: Joi.string().uuid().required(),
  catch_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  total_encounters: Joi.number().integer().min(0).default(0),
  species_encounters: Joi.number().integer().min(0).default(0),
  encounter_type: Joi.string().valid(...ENCOUNTER_TYPE_CHOICES).required(),
  location: Joi.string().max(100).optional(),
  nature: Joi.string().max(20).optional(),
  iv_hp: Joi.number().integer().min(0).max(31).optional(),
  iv_attack: Joi.number().integer().min(0).max(31).optional(),
  iv_defense: Joi.number().integer().min(0).max(31).optional(),
  iv_sp_attack: Joi.number().integer().min(0).max(31).optional(),
  iv_sp_defense: Joi.number().integer().min(0).max(31).optional(),
  iv_speed: Joi.number().integer().min(0).max(31).optional(),
  is_secret: Joi.boolean().default(false),
  is_alpha: Joi.boolean().default(false),
  screenshot_url: Joi.string().uri().optional(),
  status: Joi.string().valid(...SHINY_STATUS_CHOICES).default('Owned'),
  notes: Joi.string().allow(null).optional()
});

const updateShinySchema = Joi.object({
  national_number: Joi.number().integer().min(1).max(1010).optional(),
  pokemon: Joi.string().max(50).optional(),
  variants: Joi.string().trim().lowercase().max(50).optional(),
  original_trainer: Joi.string().uuid().optional(),
  catch_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  total_encounters: Joi.number().integer().min(0).optional(),
  species_encounters: Joi.number().integer().min(0).optional(),
  encounter_type: Joi.string().valid(...ENCOUNTER_TYPE_CHOICES).optional(),
  location: Joi.string().max(100).optional(),
  nature: Joi.string().max(20).optional(),
  iv_hp: Joi.number().integer().min(0).max(31).optional(),
  iv_attack: Joi.number().integer().min(0).max(31).optional(),
  iv_defense: Joi.number().integer().min(0).max(31).optional(),
  iv_sp_attack: Joi.number().integer().min(0).max(31).optional(),
  iv_sp_defense: Joi.number().integer().min(0).max(31).optional(),
  iv_speed: Joi.number().integer().min(0).max(31).optional(),
  is_secret: Joi.boolean().optional(),
  is_alpha: Joi.boolean().optional(),
  screenshot_url: Joi.string().uri().optional(),
  status: Joi.string().valid(...SHINY_STATUS_CHOICES).optional(),
  notes: Joi.string().allow(null).optional()
});

const screenshotSchema = Joi.object({
  screenshot_url: Joi.string().uri().required(),
  encounter_type: Joi.string().valid(...ENCOUNTER_TYPE_CHOICES).required(),
  is_secret: Joi.boolean().default(false),
  is_alpha: Joi.boolean().default(false),
  command_called_at: Joi.string().isoDate().optional(),
  discord_user_id: Joi.string().required(),
  member_roles: Joi.array().items(Joi.string()).default([]),
});

const asyncScreenshotSchema = screenshotSchema.keys({
  discord_application_id: Joi.string().required(),
  discord_interaction_token: Joi.string().required(),
  callback_url: Joi.string().uri().required(),
});

function normalizeScreenshotYear(rawYear) {
  const value = parseInt(rawYear, 10);
  if (Number.isNaN(value)) return null;
  if (String(rawYear).length === 2) return 2000 + value;
  return value;
}

function isValidDateParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 2000 || year > 2099) return false;
  if (month < 1 || month > 12) return false;

  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && (candidate.getUTCMonth() + 1) === month
    && candidate.getUTCDate() === day;
}

function formatIsoDate(year, month, day) {
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

function scoreDateCandidate({ format, first, second, third, separator, index, text }) {
  let score = 0;

  if (format === 'YMD') score += 4;
  if (first > 12 || second > 12) score += 3;
  if (separator === '-') score += 0.35;
  if (separator === '.' && format !== 'YMD') score += 0.15;

  const context = text.slice(Math.max(0, index - 12), Math.min(text.length, index + 28));
  if (/[AP]M\b/i.test(context) && format === 'MDY') score += 1.5;
  if (/[AP]M\b/i.test(context) && format === 'DMY') score -= 0.3;

  const now = new Date();
  const isoDate = formatIsoDate(
    format === 'YMD' ? first : normalizeScreenshotYear(third),
    format === 'YMD' ? second : (format === 'MDY' ? first : second),
    format === 'YMD' ? third : (format === 'MDY' ? second : first)
  );
  const parsedDate = new Date(`${isoDate}T00:00:00.000Z`);
  const ageDays = Math.abs((now.getTime() - parsedDate.getTime()) / 86400000);

  if (parsedDate.getUTCFullYear() === now.getUTCFullYear()) score += 0.2;
  if (parsedDate.getTime() > now.getTime()) score -= 1.2;
  if (ageDays <= 366) score += 0.25;

  return score;
}

function extractDateFromOcr(text) {
  const pattern = /\b(\d{1,4})([\/.-])(\d{1,2})\2(\d{1,4})\b/g;
  const candidates = [];
  let hasAmbiguousCandidate = false;

  for (const match of text.matchAll(pattern)) {
    const rawFirst = match[1];
    const separator = match[2];
    const rawSecond = match[3];
    const rawThird = match[4];
    const first = parseInt(rawFirst, 10);
    const second = parseInt(rawSecond, 10);
    const third = parseInt(rawThird, 10);
    const index = match.index || 0;

    if ([first, second, third].some((value) => Number.isNaN(value))) continue;

    if (rawFirst.length !== 4 && first <= 12 && second <= 12) {
      hasAmbiguousCandidate = true;
      continue;
    }

    const interpretations = rawFirst.length === 4
      ? [{ format: 'YMD', year: first, month: second, day: third }]
      : [
        first > 12
          ? { format: 'DMY', year: normalizeScreenshotYear(rawThird), month: second, day: first }
          : { format: 'MDY', year: normalizeScreenshotYear(rawThird), month: first, day: second },
      ];

    for (const interpretation of interpretations) {
      if (!isValidDateParts(interpretation.year, interpretation.month, interpretation.day)) continue;

      candidates.push({
        isoDate: formatIsoDate(interpretation.year, interpretation.month, interpretation.day),
        score: scoreDateCandidate({
          format: interpretation.format,
          first,
          second,
          third,
          separator,
          index,
          text,
        }),
      });
    }
  }

  candidates.sort((left, right) => right.score - left.score);

  if (candidates[0]) {
    return {
      isoDate: candidates[0].isoDate,
      wasAmbiguous: false,
    };
  }

  return {
    isoDate: null,
    wasAmbiguous: hasAmbiguousCandidate,
  };
}

function normalizeEncounterDigits(value) {
  const token = String(value || '')
    .replace(/[Oo]/g, '0')
    .replace(/[Il]/g, '1')
    .replace(/[Zz]/g, '2')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8')
    .replace(/[£]/g, '2')
    .replace(/[°•]/g, '0')
    .replace(/[-_.]/g, '')
    .replace(/[^0-9]/g, '');

  if (!/^\d{3,7}$/.test(token)) return null;
  const parsed = parseInt(token, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeEncounterLabel(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function extractEncounterValueFromLine(line) {
  const afterLabel = /encounters?[^:]*:\s*([^\s|]+)/i.exec(line);
  if (afterLabel) {
    return normalizeEncounterDigits(afterLabel[1]);
  }

  if (/encounters?/i.test(line)) {
    return null;
  }

  const tokens = String(line || '').match(/[A-Za-z0-9£]{3,7}/g) || [];
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const parsed = normalizeEncounterDigits(tokens[index]);
    if (parsed !== null) return parsed;
  }

  return null;
}

function getOcrEncounterCandidates(lines, pokemonName) {
  const normalizedPokemon = normalizeEncounterLabel(pokemonName);

  return lines
    .map((line) => {
      const normalizedLine = normalizeEncounterLabel(line);
      const value = extractEncounterValueFromLine(line);
      if (value === null) return null;

      const mentionsEncounters = normalizedLine.includes('encounter');
      if (!mentionsEncounters) return null;

      const totalLabelConfidence = (() => {
        if (normalizedLine.includes('totalencounter')) return 0.9;
        if (normalizedLine.includes('talencounter') || normalizedLine.includes('bencounter')) return 0.76;
        return 0;
      })();

      const speciesNameConfidence = (() => {
        if (!normalizedPokemon) return 0;
        const compactLine = normalizedLine.replace(/encounters?$/, '');
        const distance = levenshtein(normalizedPokemon, compactLine);
        const similarity = 1 - (distance / Math.max(normalizedPokemon.length, compactLine.length, 1));
        if (similarity >= 0.72) return 0.86;
        if (similarity >= 0.5) return 0.72;
        if (compactLine.includes(normalizedPokemon.slice(Math.max(0, normalizedPokemon.length - 4)))) return 0.74;
        if (compactLine.includes(normalizedPokemon.slice(1))) return 0.78;
        return 0;
      })();

      return {
        line,
        value,
        totalConfidence: totalLabelConfidence,
        speciesConfidence: speciesNameConfidence,
      };
    })
    .filter(Boolean);
}

function pickEncounterCandidate(candidates, kind) {
  const scored = candidates
    .map((candidate) => {
      const baseConfidence = kind === 'total' ? candidate.totalConfidence : candidate.speciesConfidence;
      const conflictingValues = candidates.filter((other) => (
        other !== candidate &&
        ((kind === 'total' ? other.totalConfidence : other.speciesConfidence) > 0) &&
        other.value !== candidate.value
      ));

      const confidence = conflictingValues.length > 0
        ? Math.max(0, baseConfidence - 0.08)
        : baseConfidence;

      return {
        ...candidate,
        confidence,
      };
    })
    .filter((candidate) => candidate.confidence > 0)
    .sort((left, right) => right.confidence - left.confidence);

  return scored[0] || null;
}

function chooseEncounterValue({ parsedValue, parsedConfidence, mobileValue, mobileConfidence }) {
  const hasParsed = Number.isInteger(parsedValue);
  const hasMobile = Number.isInteger(mobileValue);

  if (!hasParsed) return hasMobile ? mobileValue : null;
  if (!hasMobile) return parsedValue;

  return (mobileConfidence || 0) >= (parsedConfidence || 0) ? mobileValue : parsedValue;
}

function parseDataFromOcr(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const dateResult = extractDateFromOcr(text);

  const name = (() => {
    const match = /Shiny\s+([A-Za-z]+)/i.exec(text);
    if (match?.[1]) return match[1].trim();
    return lines[0] || null;
  })();

  const trainer = (() => {
    const match = /caught by\s+([A-Za-z0-9_]+)/i.exec(text);
    return match?.[1]?.trim() || null;
  })();

  const ivMatch = /\b(?:3[01]|[12][0-9]|[0-9])(?:\/(?:3[01]|[12][0-9]|[0-9])){5}\b/.exec(text);
  const ivs = ivMatch ? ivMatch[0].split('/').map(value => parseInt(value, 10)) : [];

  const nature = (() => {
    const match = /N?atu?r?e?:\s+([A-Za-z]+)/i.exec(text);
    return normalizeNatureCandidate(match?.[1]) || null;
  })();

  const encounterCandidates = getOcrEncounterCandidates(lines, name);
  const totalEncounterCandidate = pickEncounterCandidate(encounterCandidates, 'total');
  const speciesEncounterCandidate = pickEncounterCandidate(encounterCandidates, 'species');

  return {
    date: dateResult.isoDate,
    dateWasAmbiguous: dateResult.wasAmbiguous,
    name,
    trainer,
    hp: ivs[0] ?? null,
    atk: ivs[1] ?? null,
    def: ivs[2] ?? null,
    spa: ivs[3] ?? null,
    spd: ivs[4] ?? null,
    spe: ivs[5] ?? null,
    nature,
    totalEncounters: totalEncounterCandidate?.value ?? null,
    totalEncountersConfidence: totalEncounterCandidate?.confidence ?? 0,
    speciesEncounters: speciesEncounterCandidate?.value ?? null,
    speciesEncountersConfidence: speciesEncounterCandidate?.confidence ?? 0,
  };
}

function levenshtein(leftValue, rightValue) {
  const left = String(leftValue || '').toLowerCase();
  const right = String(rightValue || '').toLowerCase();
  const rows = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));

  for (let i = 0; i <= left.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) rows[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost
      );
    }
  }

  return rows[left.length][right.length];
}

function normalizeNatureCandidate(value) {
  const token = String(value || '').replace(/[^A-Za-z]/g, '');
  if (!token) return null;

  let bestNature = null;
  let bestConfidence = 0;

  for (const nature of NATURE_CHOICES) {
    const maxLength = Math.max(token.length, nature.length);
    const confidence = maxLength === 0 ? 0 : Math.max(0, 1 - (levenshtein(token, nature) / maxLength));
    if (confidence > bestConfidence) {
      bestNature = nature;
      bestConfidence = confidence;
    }
  }

  return bestConfidence >= 0.55 ? bestNature : null;
}

function normalizeIgnForComparison(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[|!1il]/g, 'l');
}

async function findTrainerFromOcr(parsedTrainer) {
  if (!parsedTrainer) return null;

  const exactMatch = await TeamMember.findByIgn(parsedTrainer);
  if (exactMatch) return exactMatch;

  const normalizedTrainer = normalizeIgnForComparison(parsedTrainer);
  if (!normalizedTrainer) return null;

  const members = await TeamMember.findAll();
  const candidates = members.filter((member) => (
    normalizeIgnForComparison(member.ign) === normalizedTrainer
  ));

  return candidates.length === 1 ? candidates[0] : null;
}

function detectScreenshotLayout(width, height) {
  return width / height >= 1.6 ? 'mobile' : 'desktop';
}

function createOcrJob(name, pipeline, options) {
  return {
    name,
    bufferPromise: pipeline.toBuffer(),
    options,
  };
}

async function buildOcrJobs(imageBuffer, sharp) {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) {
    throw new Error('Unable to read screenshot dimensions for OCR preprocessing.');
  }

  const layout = detectScreenshotLayout(width, height);
  const jobs = [];

  if (layout === 'mobile') {
    const headerHeight = Math.max(1, Math.floor(height * 0.12));
    const statsTop = Math.max(0, Math.floor(height * 0.78));
    const statsWidth = Math.max(1, Math.floor(width * 0.9));
    const statsHeight = Math.max(1, height - statsTop);

    jobs.push(createOcrJob(
      'mobile-header',
      image
        .clone()
        .extract({ left: 0, top: 0, width, height: headerHeight })
        .greyscale()
        .normalize()
        .threshold(175)
        .resize({ width: Math.max(width * 2, 2400) })
        .sharpen({ sigma: 1 }),
      {
        tessedit_pageseg_mode: '7',
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/,:!- ',
      }
    ));

    jobs.push(createOcrJob(
      'mobile-stats-threshold',
      image
        .clone()
        .extract({ left: 0, top: statsTop, width: statsWidth, height: statsHeight })
        .greyscale()
        .negate()
        .normalize()
        .threshold(145)
        .resize({ width: Math.max(statsWidth * 3, 2600) })
        .sharpen({ sigma: 1.3 }),
      {
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/: ',
      }
    ));

    jobs.push(createOcrJob(
      'mobile-stats-color-safe',
      image
        .clone()
        .extract({ left: 0, top: statsTop, width: statsWidth, height: statsHeight })
        .greyscale()
        .negate()
        .normalize()
        .resize({ width: Math.max(statsWidth * 3, 2600) })
        .sharpen({ sigma: 1.3 }),
      {
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/: ',
      }
    ));
  } else {
    const headerTop = Math.max(0, Math.floor(height * 0.08));
    const headerHeight = Math.max(1, Math.floor(height * 0.24));
    const statsHeight = Math.max(1, Math.floor(height * 0.26));
    const statsTop = Math.max(0, height - statsHeight);

    jobs.push(createOcrJob(
      'desktop-header',
      image
        .clone()
        .extract({
          left: 0,
          top: headerTop,
          width,
          height: Math.min(headerHeight, height - headerTop),
        })
        .greyscale()
        .normalize()
        .resize({ width: Math.max(width * 3, 1800) })
        .sharpen({ sigma: 1.2 }),
      {
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/:,!- ',
      }
    ));

    jobs.push(createOcrJob(
      'desktop-main-color-safe',
      image
        .clone()
        .greyscale()
        .normalize()
        .resize({ width: Math.max(width * 2, 1800) })
        .sharpen({ sigma: 1.1 }),
      {
        tessedit_pageseg_mode: '11',
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/:,!- ',
      }
    ));

    jobs.push(createOcrJob(
      'desktop-main-threshold',
      image
        .clone()
        .greyscale()
        .negate()
        .normalize()
        .threshold(180)
        .resize({ width: Math.max(width, 1500) })
        .sharpen({ sigma: 1 }),
      {
        tessedit_pageseg_mode: '11',
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/:,!- ',
      }
    ));

    jobs.push(createOcrJob(
      'desktop-stats-threshold',
      image
        .clone()
        .extract({
          left: 0,
          top: statsTop,
          width,
          height: height - statsTop,
        })
        .greyscale()
        .negate()
        .normalize()
        .threshold(155)
        .resize({ width: Math.max(width * 3, 1800) })
        .sharpen({ sigma: 1.2 }),
      {
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/: ',
      }
    ));

    jobs.push(createOcrJob(
      'desktop-stats',
      image
        .clone()
        .extract({
          left: 0,
          top: statsTop,
          width,
          height: height - statsTop,
        })
        .greyscale()
        .negate()
        .normalize()
        .resize({ width: Math.max(width * 3, 1800) })
        .sharpen({ sigma: 1.2 }),
      {
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/: ',
      }
    ));
  }

  return { layout, jobs };
}

function validateParsedData(data) {
  if (!data.name) {
    return { isValid: false, error: 'Pokemon name is missing or invalid.' };
  }

  if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    return { isValid: false, error: 'Date is missing or invalid.' };
  }

  return { isValid: true, error: null };
}

function mergeParsedStats(parsed, stats) {
  if (!stats) return parsed;

  const mobileNatureConfidence = stats.meta?.recognizers?.nature?.confidence || 0;
  const mobileTotalConfidence = stats.meta?.recognizers?.totalEncounters?.confidence || 0;
  const mobileSpeciesConfidence = stats.meta?.recognizers?.speciesEncounters?.confidence || 0;
  const ocrTotalConfidence = parsed.totalEncountersConfidence || 0;
  const ocrSpeciesConfidence = parsed.speciesEncountersConfidence || 0;

  return {
    ...parsed,
    hp: Number.isInteger(stats.hp) ? stats.hp : parsed.hp,
    atk: Number.isInteger(stats.atk) ? stats.atk : parsed.atk,
    def: Number.isInteger(stats.def) ? stats.def : parsed.def,
    spa: Number.isInteger(stats.spa) ? stats.spa : parsed.spa,
    spd: Number.isInteger(stats.spd) ? stats.spd : parsed.spd,
    spe: Number.isInteger(stats.spe) ? stats.spe : parsed.spe,
    nature: mobileNatureConfidence >= 0.8 ? (stats.nature || parsed.nature) : parsed.nature,
    totalEncounters: chooseEncounterValue({
      parsedValue: parsed.totalEncounters,
      parsedConfidence: ocrTotalConfidence,
      mobileValue: stats.totalEncounters,
      mobileConfidence: mobileTotalConfidence,
    }),
    speciesEncounters: chooseEncounterValue({
      parsedValue: parsed.speciesEncounters,
      parsedConfidence: ocrSpeciesConfidence,
      mobileValue: stats.speciesEncounters,
      mobileConfidence: mobileSpeciesConfidence,
    }),
  };
}

async function createShinyFromScreenshotValue(value) {
  let ocrWorker = null;

  try {
    const { sharp, Tesseract } = loadOcrDependencies();
    ocrWorker = await createOcrWorker(Tesseract);
    const ocrClient = ocrWorker || Tesseract;
    const imageResponse = await fetch(value.screenshot_url);
    if (!imageResponse.ok) {
      const error = new Error('Failed to download screenshot.');
      error.status = 400;
      throw error;
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const { layout, jobs } = await buildOcrJobs(imageBuffer, sharp);
    const ocrResults = [];

    for (const job of jobs) {
      const buffer = await job.bufferPromise;
      const result = ocrWorker
        ? await ocrClient.recognize(buffer, job.options)
        : await ocrClient.recognize(buffer, 'eng', job.options);

      ocrResults.push({
        name: job.name,
        text: result?.data?.text || '',
      });
    }

    const ocrText = ocrResults
      .map((result) => result.text)
      .filter(Boolean)
      .join('\n');
    console.log('OCR Layout: ', layout);
    console.log('OCR Result: ', ocrText);

    const parsed = parseDataFromOcr(ocrText);
    let mobileStats = null;

    if (layout === 'mobile') {
      mobileStats = await parseMobileStatsPanel({
        imageBuffer,
        sharp,
        Tesseract: ocrClient,
        existingNature: parsed.nature,
        pokemonName: parsed.name,
      });
      // console.log(formatMobileStatsLog(mobileStats));
    }

    const mergedParsed = mergeParsedStats(parsed, mobileStats);
    const notes = [];

    if (mergedParsed.dateWasAmbiguous) {
      const fallbackDate = String(value.command_called_at || new Date().toISOString()).slice(0, 10);
      mergedParsed.date = fallbackDate;
      notes.push(`Note: ambiguous date in screenshot. Used today's date ${fallbackDate}. Press **Edit** > **Edit Text Fields** to change.`);
    }

    const validation = validateParsedData(mergedParsed);

    if (!validation.isValid) {
      const error = new Error(`OCR validation failed: ${validation.error}`);
      error.status = 422;
      error.details = { ocr_text: ocrText };
      throw error;
    }

    const member = await TeamMember.findByDiscordId(value.discord_user_id);
    const hasSojuRole = value.member_roles.includes('Soju');
    const hasStaffRole = value.member_roles.includes('Elite 4') || value.member_roles.includes('Champion');

    if (hasSojuRole && !hasStaffRole) {
      if (!member) {
        const error = new Error('Your Discord account is not registered in the member database.');
        error.status = 403;
        throw error;
      }

      if (normalizeIgnForComparison(member.ign) !== normalizeIgnForComparison(mergedParsed.trainer)) {
        const error = new Error(`You can only manage shinies for your registered IGN: ${member.ign}`);
        error.status = 403;
        throw error;
      }
    }

    const trainer = await findTrainerFromOcr(mergedParsed.trainer);
    if (!trainer) {
      const error = new Error(`Could not find trainer with IGN "${mergedParsed.trainer}"`);
      error.status = 404;
      error.details = { ocr_text: ocrText };
      throw error;
    }

    const variantData = await getPokemonVariants(mergedParsed.name);
    const nationalNumber = variantData?.national_number ?? await getNationalNumber(mergedParsed.name);
    if (!nationalNumber) {
      const error = new Error(`Could not find national number for Pokemon "${mergedParsed.name}"`);
      error.status = 404;
      error.details = { ocr_text: ocrText };
      throw error;
    }

    const shiny = await TeamShiny.create({
      national_number: nationalNumber,
      pokemon: mergedParsed.name,
      variants: normalizeVariantName(mergedParsed.name),
      original_trainer: trainer.id,
      catch_date: mergedParsed.date,
      encounter_type: value.encounter_type,
      is_secret: value.is_secret,
      is_alpha: value.is_alpha,
      screenshot_url: value.screenshot_url,
      total_encounters: Number.isInteger(mergedParsed.totalEncounters) ? mergedParsed.totalEncounters : 0,
      species_encounters: Number.isInteger(mergedParsed.speciesEncounters) ? mergedParsed.speciesEncounters : 0,
      ...(mergedParsed.nature ? { nature: mergedParsed.nature } : {}),
      ...(Number.isInteger(mergedParsed.hp) ? { iv_hp: mergedParsed.hp } : {}),
      ...(Number.isInteger(mergedParsed.atk) ? { iv_attack: mergedParsed.atk } : {}),
      ...(Number.isInteger(mergedParsed.def) ? { iv_defense: mergedParsed.def } : {}),
      ...(Number.isInteger(mergedParsed.spa) ? { iv_sp_attack: mergedParsed.spa } : {}),
      ...(Number.isInteger(mergedParsed.spd) ? { iv_sp_defense: mergedParsed.spd } : {}),
      ...(Number.isInteger(mergedParsed.spe) ? { iv_speed: mergedParsed.spe } : {}),
    });

    console.log('Saved Shiny Encounters', {
      parsed: {
        totalEncounters: parsed.totalEncounters,
        speciesEncounters: parsed.speciesEncounters,
        totalEncountersConfidence: parsed.totalEncountersConfidence,
        speciesEncountersConfidence: parsed.speciesEncountersConfidence,
      },
      mobile: {
        totalEncounters: mobileStats?.totalEncounters ?? null,
        speciesEncounters: mobileStats?.speciesEncounters ?? null,
        totalConfidence: mobileStats?.meta?.recognizers?.totalEncounters?.confidence ?? 0,
        speciesConfidence: mobileStats?.meta?.recognizers?.speciesEncounters?.confidence ?? 0,
      },
      merged: {
        totalEncounters: mergedParsed.totalEncounters,
        speciesEncounters: mergedParsed.speciesEncounters,
      },
      saved: {
        id: shiny.id,
        totalEncounters: shiny.total_encounters,
        speciesEncounters: shiny.species_encounters,
      },
    });

    return { shiny, ocrText, notes };
  } finally {
    if (ocrWorker) {
      await ocrWorker.terminate().catch((terminateError) => {
        console.error('Failed to terminate OCR worker:', terminateError);
      });
    }
  }
}

function enqueueAsyncScreenshotJob(payload) {
  const job = {
    id: createScreenshotJobId(),
    status: SCREENSHOT_JOB_STATUS.queued,
    payload,
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    error: null,
  };

  screenshotJobs.push(job);
  void processAsyncScreenshotQueue();
  return job;
}

async function processAsyncScreenshotQueue() {
  if (screenshotQueueActive) return;
  screenshotQueueActive = true;

  try {
    while (screenshotJobs.length > 0) {
      const job = screenshotJobs.shift();
      if (!job) continue;

      job.status = SCREENSHOT_JOB_STATUS.processing;
      job.startedAt = new Date().toISOString();

      try {
        const { shiny, notes } = await createShinyFromScreenshotValue(job.payload);
        await notifyScreenshotCallback(job.payload.callback_url, {
          application_id: job.payload.discord_application_id,
          interaction_token: job.payload.discord_interaction_token,
          payload: buildAsyncScreenshotSuccessPayload(shiny, notes),
        });

        job.status = SCREENSHOT_JOB_STATUS.completed;
        job.finishedAt = new Date().toISOString();
      } catch (error) {
        job.status = SCREENSHOT_JOB_STATUS.failed;
        job.finishedAt = new Date().toISOString();
        job.error = {
          message: error.message,
          status: error.status || 500,
          details: error.details || null,
        };

        console.error('Async screenshot job failed:', {
          jobId: job.id,
          error: job.error,
        });

        try {
          await notifyScreenshotCallback(job.payload.callback_url, {
            application_id: job.payload.discord_application_id,
            interaction_token: job.payload.discord_interaction_token,
            payload: buildAsyncScreenshotErrorPayload(job.error),
          });
        } catch (webhookError) {
          console.error('Failed to deliver async screenshot job error to Discord:', webhookError);
        }
      }
    }
  } finally {
    screenshotQueueActive = false;
  }
}

// GET /api/shinies - Get all team shinies with optional filters
router.get('/', async (req, res) => {
  try {
    const filters = {};
    
    filters.active = true; // Only return shinies from active teams by default
    if (req.query.active !== undefined) filters.active = req.query.active === 'true';
    if (req.query.trainer_id) filters.trainer_id = req.query.trainer_id;
    if (req.query.pokemon_name) filters.pokemon_name = req.query.pokemon_name;
    if (req.query.encounter_type) filters.encounter_type = req.query.encounter_type;
    if (req.query.is_secret !== undefined) filters.is_secret = req.query.is_secret === 'true';
    if (req.query.is_alpha !== undefined) filters.is_alpha = req.query.is_alpha === 'true';
    if (req.query.catch_date_before) filters.catch_date_before = req.query.catch_date_before;
    if (req.query.catch_date_after) filters.catch_date_after = req.query.catch_date_after;
    if (req.query.sort_by) filters.sort_by = req.query.sort_by;
    if (req.query.sort_order) filters.sort_order = req.query.sort_order;
    if (req.query.secondary_sort_by) filters.secondary_sort_by = req.query.secondary_sort_by;
    if (req.query.secondary_sort_order) filters.secondary_sort_order = req.query.secondary_sort_order;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);

    const shinies = await TeamShiny.findAll(filters);
    res.json({
      success: true,
      data: shinies,
      count: shinies.length
    });
  } catch (error) {
    console.error('Error fetching shinies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team shinies'
    });
  }
});

// GET /api/shinies/stats - Get team shiny statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await TeamShiny.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching shiny stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shiny statistics'
    });
  }
});

// GET /api/shinies/leaderboard - Get top trainers by shiny count
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = await TeamShiny.getTopTrainers(limit);
    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard'
    });
  }
});

// POST /api/shinies/from-screenshot - Create shiny entry from screenshot with OCR
router.post('/from-screenshot', authenticateBot, async (req, res) => {
  try {
    const { error, value } = screenshotSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details,
      });
    }

    const { shiny, notes } = await createShinyFromScreenshotValue(value);

    res.status(201).json({
      success: true,
      data: shiny,
      ...(notes?.length ? { notes } : {}),
      message: 'Shiny entry created successfully from screenshot',
    });
  } catch (routeError) {
    console.error('Error creating shiny from screenshot:', routeError);
    if (routeError.code === 'MODULE_NOT_FOUND') {
      return res.status(500).json({
        success: false,
        message: 'Screenshot OCR is not available on this server. Missing runtime dependency.',
      });
    }

    res.status(routeError.status || 500).json({
      success: false,
      message: routeError.message || 'Failed to create shiny entry from screenshot',
      ...(routeError.details ? { details: routeError.details } : {}),
    });
  }
});

router.post('/from-screenshot/async', authenticateBot, async (req, res) => {
  try {
    const { error, value } = asyncScreenshotSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details,
      });
    }

    const job = enqueueAsyncScreenshotJob(value);
    return res.status(202).json({
      success: true,
      data: {
        job_id: job.id,
        status: job.status,
      },
      message: 'Screenshot job queued successfully',
    });
  } catch (routeError) {
    console.error('Error queueing shiny from screenshot:', routeError);
    return res.status(500).json({
      success: false,
      message: 'Failed to queue shiny entry from screenshot',
    });
  }
});

async function handleGreyscaleSprite(req, res) {
  try {
    const nationalNumber = parseInt(req.params.nationalNumber, 10);
    const variant = typeof req.query.variant === 'string'
      ? normalizeVariantName(req.query.variant)
      : null;
    if (!Number.isInteger(nationalNumber) || nationalNumber < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid national number',
      });
    }

    const spriteUrl = await getSpriteUrl(nationalNumber, { variant });
    if (!spriteUrl) {
      return res.status(404).json({
        success: false,
        message: 'Sprite not found',
      });
    }

    const spriteBuffer = await greyscale(spriteUrl);
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Content-Disposition', `inline; filename=\"pokemon-${nationalNumber}-greyscale.gif\"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(spriteBuffer);
  } catch (error) {
    console.error('Error generating greyscale sprite:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate greyscale sprite',
    });
  }
}

// GET /api/shinies/sprites/:nationalNumber/greyscale(.gif) - Get greyscale animated sprite for Pokemon
router.get('/sprites/:nationalNumber/greyscale', handleGreyscaleSprite);
router.get('/sprites/:nationalNumber/greyscale.gif', handleGreyscaleSprite);

// GET /api/shinies/:id - Get shiny by ID
router.get('/:id', async (req, res) => {
  try {
    const shiny = await TeamShiny.findById(req.params.id);
    if (!shiny) {
      return res.status(404).json({
        success: false,
        message: 'Shiny not found'
      });
    }
    res.json({
      success: true,
      data: shiny
    });
  } catch (error) {
    console.error('Error fetching shiny:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shiny'
    });
  }
});

// POST /api/shinies - Create new shiny entry
router.post('/', authenticateBot, async (req, res) => {
  try {
    const { error, value } = shinySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }

    const shiny = await TeamShiny.create(await enrichShinyPayloadWithVariants(value));
    res.status(201).json({
      success: true,
      data: shiny,
      message: 'Shiny entry created successfully'
    });
  } catch (error) {
    console.error('Error creating shiny:', error);
    if (error.code === '23503') { // Foreign key constraint violation
      return res.status(400).json({
        success: false,
        message: 'Invalid trainer ID or Pokemon number'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create shiny entry'
    });
  }
});

// PUT /api/shinies/:id - Update shiny entry
router.put('/:id', authenticateBot, async (req, res) => {
  try {
    const { error, value } = updateShinySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }

    const shiny = await TeamShiny.update(req.params.id, await enrichShinyPayloadWithVariants(value));
    if (!shiny) {
      return res.status(404).json({
        success: false,
        message: 'Shiny not found'
      });
    }

    res.json({
      success: true,
      data: shiny,
      message: 'Shiny entry updated successfully'
    });
  } catch (error) {
    console.error('Error updating shiny:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update shiny entry'
    });
  }
});

// DELETE /api/shinies/:id - Delete shiny entry
router.delete('/:id', authenticateBot, async (req, res) => {
  try {
    const shiny = await TeamShiny.delete(req.params.id);
    if (!shiny) {
      return res.status(404).json({
        success: false,
        message: 'Shiny not found'
      });
    }

    res.json({
      success: true,
      data: shiny,
      message: 'Shiny entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting shiny:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete shiny entry'
    });
  }
});

router._test = {
  buildOcrJobs,
  createOcrWorker,
  getOcrEncounterCandidates,
  loadOcrDependencies,
  mergeParsedStats,
  parseDataFromOcr,
  pickEncounterCandidate,
  chooseEncounterValue,
};

module.exports = router;
