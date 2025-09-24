const express = require('express');
const Joi = require('joi');
const TeamShiny = require('../models/TeamShiny');
const router = express.Router();

// Validation schema
const shinySchema = Joi.object({
  pokedex_number: Joi.number().integer().min(1).max(1010).required(),
  original_trainer: Joi.string().uuid().required(),
  catch_date: Joi.date().required(),
  total_encounters: Joi.number().integer().min(0).default(0),
  species_encounters: Joi.number().integer().min(0).default(0),
  encounter_type: Joi.string().valid(
    'wild', 'horde', 'safari', 'fishing', 'egg', 'gift', 'trade', 'event'
  ).required(),
  location: Joi.string().max(100).optional(),
  level_caught: Joi.number().integer().min(1).max(100).optional(),
  nature: Joi.string().max(20).optional(),
  ability: Joi.string().max(30).optional(),
  iv_hp: Joi.number().integer().min(0).max(31).optional(),
  iv_attack: Joi.number().integer().min(0).max(31).optional(),
  iv_defense: Joi.number().integer().min(0).max(31).optional(),
  iv_sp_attack: Joi.number().integer().min(0).max(31).optional(),
  iv_sp_defense: Joi.number().integer().min(0).max(31).optional(),
  iv_speed: Joi.number().integer().min(0).max(31).optional(),
  is_secret: Joi.boolean().default(false),
  is_safari: Joi.boolean().default(false),
  screenshot_url: Joi.string().uri().optional(),
  notes: Joi.string().optional()
});

const updateShinySchema = shinySchema.fork(
  ['pokedex_number', 'original_trainer', 'catch_date', 'encounter_type'],
  (schema) => schema.optional()
);

// GET /api/shinies - Get all team shinies with optional filters
router.get('/', async (req, res) => {
  try {
    const filters = {};
    
    if (req.query.trainer_id) filters.trainer_id = req.query.trainer_id;
    if (req.query.pokemon_name) filters.pokemon_name = req.query.pokemon_name;
    if (req.query.encounter_type) filters.encounter_type = req.query.encounter_type;
    if (req.query.is_secret !== undefined) filters.is_secret = req.query.is_secret === 'true';
    if (req.query.is_safari !== undefined) filters.is_safari = req.query.is_safari === 'true';
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
router.post('/', async (req, res) => {
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
router.put('/:id', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
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