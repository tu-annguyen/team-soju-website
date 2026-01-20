const express = require('express');
const Joi = require('joi');
const TeamMember = require('../models/TeamMember');
const router = express.Router();

// Validation schemas
const memberSchema = Joi.object({
  ign: Joi.string().min(1).max(50).required(),
  discord_id: Joi.string().max(20).optional(),
  rank: Joi.string().max(20).default('Member'),
  notes: Joi.string().optional()
});

const updateMemberSchema = Joi.object({
  ign: Joi.string().min(1).max(50).optional(),
  discord_id: Joi.string().max(20).optional(),
  rank: Joi.string().max(20).optional(),
  notes: Joi.string().optional(),
  join_date: Joi.date().optional(),
  is_active: Joi.boolean().optional()
});

// GET /api/members - Get all team members
router.get('/', async (req, res) => {
  try {
    const members = await TeamMember.findAll();
    res.json({
      success: true,
      data: members
    });
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team members'
    });
  }
});

// GET /api/members/:id - Get member by ID
router.get('/:id', async (req, res) => {
  try {
    const member = await TeamMember.findById(req.params.id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }
    res.json({
      success: true,
      data: member
    });
  } catch (error) {
    console.error('Error fetching member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team member'
    });
  }
});

// GET /api/members/ign/:ign - Get member by IGN
router.get('/ign/:ign', async (req, res) => {
  try {
    const member = await TeamMember.findByIgn(req.params.ign);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }
    res.json({
      success: true,
      data: member
    });
  } catch (error) {
    console.error('Error fetching member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team member'
    });
  }
});

// GET /api/members/ign/inactive/:ign - Get member by IGN including inactive
router.get('/ign/inactive/:ign', async (req, res) => {
  try {
    const member = await TeamMember.findByIgnIncludingInactive(req.params.ign);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }
    if (member.is_active) {
      return res.status(400).json({
        success: false,
        message: 'Team member is already active'
      });
    }
    res.json({
      success: true,
      data: member
    });
  } catch (error) {
    console.error('Error fetching member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team member'
    });
  }
});

// GET /api/members/discord/:discordId - Get member by Discord ID
router.get('/discord/:discordId', async (req, res) => {
  try {
    const member = await TeamMember.findByDiscordId(req.params.discordId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }
    res.json({
      success: true,
      data: member
    });
  } catch (error) {
    console.error('Error fetching member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team member'
    });
  }
});

// POST /api/members - Create new team member
router.post('/', async (req, res) => {
  try {
    const { error, value } = memberSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }

    const member = await TeamMember.create(value);
    res.status(201).json({
      success: true,
      data: member,
      message: 'Team member created successfully'
    });
  } catch (error) {
    console.error('Error creating member:', error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        success: false,
        message: 'A member with this IGN or Discord ID already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create team member'
    });
  }
});

// PUT /api/members/:id - Update team member
router.put('/:id', async (req, res) => {
  try {
    const { error, value } = updateMemberSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
    }

    const member = await TeamMember.update(req.params.id, value);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }

    res.json({
      success: true,
      data: member,
      message: 'Team member updated successfully'
    });
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update team member'
    });
  }
});

// DELETE /api/members/:id - Delete (deactivate) team member
router.delete('/:id', async (req, res) => {
  try {
    const member = await TeamMember.delete(req.params.id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }

    res.json({
      success: true,
      message: 'Team member deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete team member'
    });
  }
});

// PUT /api/members/reactivate/:id - Reactivate team member
router.put('/reactivate/:id', async (req, res) => {
  try {
    const member = await TeamMember.reactivate(req.params.id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }
    res.json({
      success: true,
      data: member,
      message: 'Team member reactivated successfully'
    });
  } catch (error) {
    console.error('Error reactivating member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reactivate team member'
    });
  }
});

// GET /api/members/:id/stats - Get member's shiny statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const stats = await TeamMember.getShinyStats(req.params.id);
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching member stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member statistics'
    });
  }
});

module.exports = router;