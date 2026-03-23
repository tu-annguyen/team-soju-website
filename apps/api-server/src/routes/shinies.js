const express = require('express');
const Joi = require('joi');
const { getPokemonNationalNumber, getSpriteUrl, greyscale } = require('@team-soju/utils');
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

// Validation schema
const shinySchema = Joi.object({
  national_number: Joi.number().integer().min(1).max(1010).required(),
  pokemon: Joi.string().max(50).required(),
  original_trainer: Joi.string().uuid().required(),
  catch_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  total_encounters: Joi.number().integer().min(0).default(0),
  species_encounters: Joi.number().integer().min(0).default(0),
  encounter_type: Joi.string().valid(
    'single', 'horde', 'safari', 'fishing', 'egg', 'mysterious_ball', 'honey_tree', 'rock_smash', 'swarm', 'fossil', 'headbutt', 'gift'
  ).required(),
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
  notes: Joi.string().optional()
});

const updateShinySchema = Joi.object({
  national_number: Joi.number().integer().min(1).max(1010).optional(),
  pokemon: Joi.string().max(50).optional(),
  original_trainer: Joi.string().uuid().optional(),
  catch_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  total_encounters: Joi.number().integer().min(0).optional(),
  species_encounters: Joi.number().integer().min(0).optional(),
  encounter_type: Joi.string().valid(
    'single', 'horde', 'safari', 'fishing', 'egg', 'mysterious_ball', 'honey_tree', 'rock_smash', 'swarm', 'fossil', 'headbutt', 'gift'
  ).optional(),
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
  notes: Joi.string().optional()
});

const screenshotSchema = Joi.object({
  screenshot_url: Joi.string().uri().required(),
  date_is_mdy: Joi.boolean().default(false),
  encounter_type: Joi.string().valid(
    'single', 'horde', 'safari', 'fishing', 'egg', 'mysterious_ball', 'honey_tree', 'rock_smash', 'swarm', 'fossil', 'headbutt', 'gift'
  ).required(),
  is_secret: Joi.boolean().default(false),
  is_alpha: Joi.boolean().default(false),
  discord_user_id: Joi.string().required(),
  member_roles: Joi.array().items(Joi.string()).default([]),
});

function parseDataFromOcr(text, isMDY = false) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const date = (() => {
    const match = /(\d{1,2})\/(\d{1,2})\/(\d{1,2})/.exec(text);
    if (!match) return null;
    let day = parseInt(match[1], 10);
    let monthIndex = parseInt(match[2], 10) - 1;
    if (isMDY) {
      [monthIndex, day] = [parseInt(match[1], 10) - 1, parseInt(match[2], 10)];
    }
    const year = 2000 + parseInt(match[3], 10);
    return new Date(year, monthIndex, day).toISOString().split('T')[0];
  })();

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

  const totalEncounters = (() => {
    const match = /Total Encounters:\s+(\d+)/i.exec(text);
    return match?.[1] ? parseInt(match[1], 10) : null;
  })();

  const speciesEncounters = (() => {
    if (!name) return null;
    const match = new RegExp(`${name} Encounters:\\s+(\\d+)`, 'i').exec(text);
    return match?.[1] ? parseInt(match[1], 10) : null;
  })();

  return {
    date,
    name,
    trainer,
    hp: ivs[0] ?? null,
    atk: ivs[1] ?? null,
    def: ivs[2] ?? null,
    spa: ivs[3] ?? null,
    spd: ivs[4] ?? null,
    spe: ivs[5] ?? null,
    nature,
    totalEncounters,
    speciesEncounters,
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
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/,:! ',
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
    const statsHeight = Math.max(1, Math.floor(height * 0.26));
    const statsTop = Math.max(0, height - statsHeight);

    jobs.push(createOcrJob(
      'desktop-main',
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
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/:,! ',
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

  return {
    ...parsed,
    hp: Number.isInteger(stats.hp) ? stats.hp : parsed.hp,
    atk: Number.isInteger(stats.atk) ? stats.atk : parsed.atk,
    def: Number.isInteger(stats.def) ? stats.def : parsed.def,
    spa: Number.isInteger(stats.spa) ? stats.spa : parsed.spa,
    spd: Number.isInteger(stats.spd) ? stats.spd : parsed.spd,
    spe: Number.isInteger(stats.spe) ? stats.spe : parsed.spe,
    nature: mobileNatureConfidence >= 0.8 ? (stats.nature || parsed.nature) : parsed.nature,
    totalEncounters: Number.isInteger(stats.totalEncounters) ? stats.totalEncounters : parsed.totalEncounters,
    speciesEncounters: Number.isInteger(stats.speciesEncounters) ? stats.speciesEncounters : parsed.speciesEncounters,
  };
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

    const { sharp, Tesseract } = loadOcrDependencies();
    const imageResponse = await fetch(value.screenshot_url);
    if (!imageResponse.ok) {
      return res.status(400).json({
        success: false,
        message: 'Failed to download screenshot.',
      });
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const { layout, jobs } = await buildOcrJobs(imageBuffer, sharp);
    const ocrResults = await Promise.all(jobs.map(async (job) => {
      const buffer = await job.bufferPromise;
      const result = await Tesseract.recognize(buffer, 'eng', job.options);
      return {
        name: job.name,
        text: result?.data?.text || '',
      };
    }));

    const ocrText = ocrResults
      .map((result) => result.text)
      .filter(Boolean)
      .join('\n');
    console.log('OCR Layout: ', layout);
    console.log('OCR Result: ', ocrText);
    const parsed = parseDataFromOcr(ocrText, value.date_is_mdy);
    let mobileStats = null;

    if (layout === 'mobile') {
      mobileStats = await parseMobileStatsPanel({
        imageBuffer,
        sharp,
        Tesseract,
        pokemonName: parsed.name,
      });
      console.log('Mobile Stats Parser: ', JSON.stringify({
        confidence: mobileStats.confidence,
        recognizers: mobileStats.meta?.recognizers,
      }));
    }

    const mergedParsed = mergeParsedStats(parsed, mobileStats);
    const validation = validateParsedData(mergedParsed);

    if (!validation.isValid) {
      return res.status(422).json({
        success: false,
        message: `OCR validation failed: ${validation.error}`,
        details: { ocr_text: ocrText },
      });
    }

    const member = await TeamMember.findByDiscordId(value.discord_user_id);
    const hasSojuRole = value.member_roles.includes('Soju');
    const hasStaffRole = value.member_roles.includes('Elite 4') || value.member_roles.includes('Champion');

    if (hasSojuRole && !hasStaffRole) {
      if (!member) {
        return res.status(403).json({
          success: false,
          message: 'Your Discord account is not registered in the member database.',
        });
      }

      if (normalizeIgnForComparison(member.ign) !== normalizeIgnForComparison(mergedParsed.trainer)) {
        return res.status(403).json({
          success: false,
          message: `You can only manage shinies for your registered IGN: ${member.ign}`,
        });
      }
    }

    const trainer = await findTrainerFromOcr(mergedParsed.trainer);
    if (!trainer) {
      return res.status(404).json({
        success: false,
        message: `Could not find trainer with IGN "${mergedParsed.trainer}"`,
        details: { ocr_text: ocrText },
      });
    }

    const nationalNumber = await getPokemonNationalNumber(mergedParsed.name);
    if (!nationalNumber) {
      return res.status(404).json({
        success: false,
        message: `Could not find national number for Pokemon "${mergedParsed.name}"`,
        details: { ocr_text: ocrText },
      });
    }

    const shiny = await TeamShiny.create({
      national_number: nationalNumber,
      pokemon: mergedParsed.name,
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

    res.status(201).json({
      success: true,
      data: shiny,
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

    res.status(500).json({
      success: false,
      message: 'Failed to create shiny entry from screenshot',
    });
  }
});

// GET /api/shinies/sprites/:nationalNumber/greyscale - Get greyscale sprite for Pokemon
router.get('/sprites/:nationalNumber/greyscale', async (req, res) => {
  try {
    const nationalNumber = parseInt(req.params.nationalNumber, 10);
    if (!Number.isInteger(nationalNumber) || nationalNumber < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid national number',
      });
    }

    const spriteUrl = await getSpriteUrl(nationalNumber);
    if (!spriteUrl) {
      return res.status(404).json({
        success: false,
        message: 'Sprite not found',
      });
    }

    const spriteBuffer = await greyscale(spriteUrl);
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(spriteBuffer);
  } catch (error) {
    console.error('Error generating greyscale sprite:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate greyscale sprite',
    });
  }
});

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

    const shiny = await TeamShiny.create(value);
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

    const shiny = await TeamShiny.update(req.params.id, value);
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

module.exports = router;
