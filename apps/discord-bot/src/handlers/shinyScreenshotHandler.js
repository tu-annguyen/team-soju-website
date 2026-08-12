const { codeBlock } = require('../discord/api');
const fetchClient = require('../fetchClient');
const { normalizeTimezoneInput } = require('@team-soju/utils');

function getApiBaseUrl() {
  return (process.env.API_BASE_URL || 'http://localhost:8787/api').replace(/\/+$/, '');
}

function getAuthHeaders() {
  return { headers: { Authorization: `Bearer ${process.env.BOT_API_TOKEN}` } };
}

function normalizeEncounterType(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  return ({ '5x_horde': 'x5_horde', '3x_horde': 'x3_horde' }[normalized] || normalized);
}

function getTimezoneOption(interaction) {
  const timezone = normalizeTimezoneInput(interaction.options.getString('timezone'));
  if (!timezone) throw new Error('Timezone is required and must be a valid IANA timezone.');
  return timezone;
}

function getMemberRoles(interaction) {
  return Array.from(interaction.member?.roles?.cache || []);
}

async function handleAddShinyScreenshot(interaction) {
  try {
    const callbackUrl = process.env.SCREENSHOT_RESULT_CALLBACK_URL;
    if (!callbackUrl) throw new Error('SCREENSHOT_RESULT_CALLBACK_URL is not configured.');
    if (!interaction.id) throw new Error('Discord interaction ID is missing.');

    const screenshot = interaction.options.getAttachment('screenshot');
    const response = await fetchClient.post(`${getApiBaseUrl()}/shinies/from-screenshot/async`, {
      screenshot_url: screenshot.proxyURL || screenshot.url,
      encounter_type: normalizeEncounterType(interaction.options.getString('encounter_type')),
      is_secret: interaction.options.getBoolean('secret') || false,
      is_alpha: interaction.options.getBoolean('alpha') || false,
      command_called_at: new Date(interaction.createdTimestamp || Date.now()).toISOString(),
      timezone: getTimezoneOption(interaction),
      discord_user_id: interaction.user.id,
      member_roles: getMemberRoles(interaction).map((role) => role.name),
      discord_interaction_id: interaction.id,
      discord_application_id: interaction.applicationId,
      discord_interaction_token: interaction.token,
      callback_url: callbackUrl,
    }, getAuthHeaders());
    const jobId = response.data?.data?.job_id;
    await interaction.reply({
      content: jobId
        ? `Screenshot received. Processing job \`${jobId}\` now. This message will update when OCR finishes.`
        : 'Screenshot received. Processing now. This message will update when OCR finishes.',
    });
  } catch (error) {
    const responseDetails = error.response?.data?.details;
    const validationDetails = Array.isArray(responseDetails)
      ? responseDetails.map((detail) => detail?.message).filter(Boolean).join('; ')
      : '';
    const details = responseDetails?.ocr_text
      ? `\nOCR result:\n${codeBlock(responseDetails.ocr_text)}`
      : validationDetails ? `\n${validationDetails}` : '';
    await interaction.reply({ content: `Error: ${error.response?.data?.message || error.message}${details}` });
  }
}

module.exports = { handleAddShinyScreenshot };
