const express = require('express');
const Joi = require('joi');
const FeebasBoard = require('../models/FeebasBoard');
const { FeebasRuleError, getLocationConfig } = require('../utils/feebas');

const router = express.Router();
const subscribersByLocation = new Map();
const leaderboardSortKeys = FeebasBoard.getLeaderboardSortOptions().map((option) => option.key);

const updateTileSchema = Joi.object({
  status: Joi.string().valid('unchecked', 'checked', 'pending', 'confirmed').required(),
  actorFingerprint: Joi.string().trim().min(8).max(120).required(),
  actorName: Joi.string().trim().allow('', null).max(40).optional(),
});
const actorFingerprintQuerySchema = Joi.string().trim().min(8).max(120).optional();
const leaderboardQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).optional(),
  sortBy: Joi.string().valid(...leaderboardSortKeys).optional(),
  sortDirection: Joi.string().valid('asc', 'desc').optional(),
});

async function broadcastBoard(location) {
  const subscribers = subscribersByLocation.get(location);
  if (!subscribers || subscribers.size === 0) {
    return;
  }

  await Promise.all(Array.from(subscribers).map(async (subscriber) => {
    const board = await FeebasBoard.getBoard(location, {
      actorFingerprint: subscriber.actorFingerprint,
    });
    const payload = `data: ${JSON.stringify({ success: true, data: board })}\n\n`;
    subscriber.response.write(payload);
  }));
}

router.get('/:location/leaderboard', async (req, res) => {
  try {
    getLocationConfig(req.params.location);
    const { error, value } = leaderboardQuerySchema.validate(req.query);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details,
      });
    }

    const leaderboard = await FeebasBoard.getLeaderboard(req.params.location, value);

    res.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    if (error instanceof FeebasRuleError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error('Error fetching Feebas leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Feebas leaderboard',
    });
  }
});

router.get('/:location', async (req, res) => {
  try {
    getLocationConfig(req.params.location);
    const actorFingerprint = actorFingerprintQuerySchema.validate(req.query.actorFingerprint).value;
    const board = await FeebasBoard.getBoard(req.params.location, { actorFingerprint });

    res.json({
      success: true,
      data: board,
    });
  } catch (error) {
    if (error instanceof FeebasRuleError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error('Error fetching Feebas board:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Feebas board',
    });
  }
});

router.get('/:location/stream', async (req, res) => {
  try {
    getLocationConfig(req.params.location);
    const actorFingerprint = actorFingerprintQuerySchema.validate(req.query.actorFingerprint).value;
    const board = await FeebasBoard.getBoard(req.params.location, { actorFingerprint });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const location = req.params.location;
    const subscribers = subscribersByLocation.get(location) || new Set();
    const subscriber = { response: res, actorFingerprint };
    subscribers.add(subscriber);
    subscribersByLocation.set(location, subscribers);

    res.write(`data: ${JSON.stringify({ success: true, data: board })}\n\n`);

    const heartbeat = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      subscribers.delete(subscriber);
      if (subscribers.size === 0) {
        subscribersByLocation.delete(location);
      }
      res.end();
    });
  } catch (error) {
    if (error instanceof FeebasRuleError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error('Error opening Feebas stream:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to open Feebas stream',
    });
  }
});

router.post('/:location/tiles/:tileId', async (req, res) => {
  try {
    getLocationConfig(req.params.location);
    const { error, value } = updateTileSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details,
      });
    }

    const board = await FeebasBoard.updateTile(req.params.location, req.params.tileId, value);
    await broadcastBoard(req.params.location);

    res.json({
      success: true,
      data: board,
      message: 'Feebas tile updated successfully',
    });
  } catch (error) {
    if (error instanceof FeebasRuleError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error('Error updating Feebas tile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update Feebas tile',
    });
  }
});

router.post('/:location/reset', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Feebas board reset is not available in production',
    });
  }

  try {
    getLocationConfig(req.params.location);
    const board = await FeebasBoard.resetBoard(req.params.location);
    await broadcastBoard(req.params.location);

    res.json({
      success: true,
      data: board,
      message: 'Feebas board reset successfully',
    });
  } catch (error) {
    if (error instanceof FeebasRuleError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error('Error resetting Feebas board:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset Feebas board',
    });
  }
});

module.exports = router;
