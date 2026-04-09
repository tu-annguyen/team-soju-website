const express = require('express');
const Joi = require('joi');
const FeebasBoard = require('../models/FeebasBoard');
const { FeebasRuleError, getLocationConfig } = require('../utils/feebas');

const router = express.Router();
const subscribersByLocation = new Map();

const updateTileSchema = Joi.object({
  status: Joi.string().valid('unchecked', 'checked', 'pending', 'confirmed').required(),
  actorFingerprint: Joi.string().trim().min(8).max(120).required(),
  actorName: Joi.string().trim().allow('', null).max(40).optional(),
});

function broadcastBoard(location, board) {
  const subscribers = subscribersByLocation.get(location);
  if (!subscribers || subscribers.size === 0) {
    return;
  }

  const payload = `data: ${JSON.stringify({ success: true, data: board })}\n\n`;

  subscribers.forEach((response) => {
    response.write(payload);
  });
}

router.get('/:location', async (req, res) => {
  try {
    getLocationConfig(req.params.location);
    const board = await FeebasBoard.getBoard(req.params.location);

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
    const board = await FeebasBoard.getBoard(req.params.location);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const location = req.params.location;
    const subscribers = subscribersByLocation.get(location) || new Set();
    subscribers.add(res);
    subscribersByLocation.set(location, subscribers);

    res.write(`data: ${JSON.stringify({ success: true, data: board })}\n\n`);

    const heartbeat = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      subscribers.delete(res);
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
    broadcastBoard(req.params.location, board);

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
    broadcastBoard(req.params.location, board);

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
