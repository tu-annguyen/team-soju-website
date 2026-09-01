const Joi = require('joi');
const { isValidTimezone, normalizeTimezoneInput } = require('../../utils/shinyCatchTime');

const ENCOUNTER_TYPES = [
  'single', 'x5_horde', 'x3_horde', 'horde', 'safari', 'fishing', 'raid_den', 'egg',
  'mysterious_ball', 'honey_tree', 'rock_smash', 'swarm', 'fossil', 'headbutt', 'gift',
];

const shinyScreenshotJobSchema = Joi.object({
  screenshot_url: Joi.string().uri({ scheme: ['https'] }).required(),
  encounter_type: Joi.string().valid(...ENCOUNTER_TYPES).required(),
  is_secret: Joi.boolean().default(false),
  is_alpha: Joi.boolean().default(false),
  command_called_at: Joi.string().isoDate().optional(),
  timezone: Joi.string().trim().max(80).required().custom((value, helpers) => (
    isValidTimezone(value) ? normalizeTimezoneInput(value) : helpers.error('any.invalid')
  )),
  locale: Joi.string().trim().max(35).allow(null).default(null),
  date_order: Joi.string().valid('auto', 'mdy', 'dmy', 'ymd').default('auto'),
  discord_user_id: Joi.string().max(32).required(),
  member_roles: Joi.array().items(Joi.string().max(100)).max(100).default([]),
  discord_interaction_id: Joi.string().max(32).required(),
  discord_application_id: Joi.string().max(32).required(),
  discord_interaction_token: Joi.string().max(256).required(),
  callback_url: Joi.string().uri({ scheme: ['https', 'http'] }).required(),
});

module.exports = { shinyScreenshotJobSchema };
