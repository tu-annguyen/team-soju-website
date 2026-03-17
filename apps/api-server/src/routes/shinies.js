const express = require('express');
const Joi = require('joi');
const TeamShiny = require('../models/TeamShiny');
const TeamMember = require('../models/TeamMember');
const { getPokemonNationalNumber } = require('../utils/pokedex');
const router = express.Router();
const { authenticateBot } = require('../middleware/auth');

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

  const ivMatch = /((?:[0-9]|[12][0-9]|3[01])\/){5}(?:[0-9]|[12][0-9]|3[01])/.exec(text);
  const ivs = ivMatch ? ivMatch[0].split('/').map(value => parseInt(value, 10)) : [];

  const nature = (() => {
    const match = /N?atu?r?e?:\s+([A-Za-z]+)/i.exec(text);
    return match?.[1]?.trim() || null;
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

function validateParsedData(data) {
  if (!data.name) {
    return { isValid: false, error: 'Pokemon name is missing or invalid.' };
  }

  if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    return { isValid: false, error: 'Date is missing or invalid.' };
  }

  return { isValid: true, error: null };
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

    const sharp = require('sharp');
    const Tesseract = require('tesseract.js');
    const imageResponse = await fetch(value.screenshot_url);
    if (!imageResponse.ok) {
      return res.status(400).json({
        success: false,
        message: 'Failed to download screenshot.',
      });
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const processedBuffer = await sharp(imageBuffer)
      .greyscale()
      .normalise()
      .threshold(128)
      .sharpen({ sigma: 1 })
      .toBuffer();

    const ocrResult = await Tesseract.recognize(processedBuffer, 'eng', {
      tessedit_pageseg_mode: '6',
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/°: -_—',
    });

    const ocrText = ocrResult?.data?.text || '';
    const parsed = parseDataFromOcr(ocrText, value.date_is_mdy);
    const validation = validateParsedData(parsed);

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

      if (member.ign.toLowerCase() !== String(parsed.trainer || '').toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `You can only manage shinies for your registered IGN: ${member.ign}`,
        });
      }
    }

    const trainer = await TeamMember.findByIgn(parsed.trainer);
    if (!trainer) {
      return res.status(404).json({
        success: false,
        message: `Could not find trainer with IGN "${parsed.trainer}"`,
        details: { ocr_text: ocrText },
      });
    }

    const nationalNumber = await getPokemonNationalNumber(parsed.name);
    if (!nationalNumber) {
      return res.status(404).json({
        success: false,
        message: `Could not find national number for Pokemon "${parsed.name}"`,
        details: { ocr_text: ocrText },
      });
    }

    const shiny = await TeamShiny.create({
      national_number: nationalNumber,
      pokemon: parsed.name,
      original_trainer: trainer.id,
      catch_date: parsed.date,
      encounter_type: value.encounter_type,
      is_secret: value.is_secret,
      is_alpha: value.is_alpha,
      screenshot_url: value.screenshot_url,
      total_encounters: Number.isInteger(parsed.totalEncounters) ? parsed.totalEncounters : 0,
      species_encounters: Number.isInteger(parsed.speciesEncounters) ? parsed.speciesEncounters : 0,
      ...(parsed.nature ? { nature: parsed.nature } : {}),
      ...(Number.isInteger(parsed.hp) ? { iv_hp: parsed.hp } : {}),
      ...(Number.isInteger(parsed.atk) ? { iv_attack: parsed.atk } : {}),
      ...(Number.isInteger(parsed.def) ? { iv_defense: parsed.def } : {}),
      ...(Number.isInteger(parsed.spa) ? { iv_sp_attack: parsed.spa } : {}),
      ...(Number.isInteger(parsed.spd) ? { iv_sp_defense: parsed.spd } : {}),
      ...(Number.isInteger(parsed.spe) ? { iv_speed: parsed.spe } : {}),
    });

    res.status(201).json({
      success: true,
      data: shiny,
      message: 'Shiny entry created successfully from screenshot',
    });
  } catch (routeError) {
    console.error('Error creating shiny from screenshot:', routeError);
    res.status(500).json({
      success: false,
      message: 'Failed to create shiny entry from screenshot',
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
