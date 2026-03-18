const path = require('path');
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
}

const { COMMANDS } = require('./commands');
const { getCommandHandler } = require('./commandRouter');
const {
  registerSlashCommands,
  validateEnvironment,
  checkCommandPermission,
  getCommandRequiredRoles,
} = require('./utils');
const {
  handleShinyComponent,
  handleShinyEditModal,
  isShinyComponent,
  isShinyEditModal,
} = require('./handlers/shinyHandlers');
const { DiscordInteractionContext } = require('./discord/interactionContext');
const { MessageFlags } = require('./discord/api');
const guildRoleCache = new Map();

function isDebugLoggingEnabled(env = process.env) {
  return env.DISCORD_LOG_LEVEL === 'debug' || env.DISCORD_DEBUG_LOGS === 'true';
}

function logInfo(message, details) {
  if (details) {
    console.log(message, details);
    return;
  }
  console.log(message);
}

function logDebug(env, message, details) {
  if (!isDebugLoggingEnabled(env)) return;
  logInfo(message, details);
}

function logError(message, error, details) {
  if (details) {
    console.error(message, details);
  } else {
    console.error(message);
  }

  if (error) {
    console.error(error);
  }
}

function summarizeInteraction(rawInteraction) {
  const data = rawInteraction?.data || {};

  return {
    id: rawInteraction?.id,
    type: rawInteraction?.type,
    commandName: data?.name || null,
    customId: data?.custom_id || null,
    componentType: data?.component_type || null,
    values: data?.values || [],
    guildId: rawInteraction?.guild_id || null,
    channelId: rawInteraction?.channel_id || null,
    userId: rawInteraction?.member?.user?.id || rawInteraction?.user?.id || null,
  };
}

function summarizeInitialResponse(response) {
  return {
    type: response?.type,
    data: {
      flags: response?.data?.flags,
      content: response?.data?.content || null,
      embeds: response?.data?.embeds?.length || 0,
      components: response?.data?.components?.length || 0,
    },
  };
}

function validateSelectOption(option, path, issues) {
  if (!option || typeof option !== 'object') {
    issues.push(`${path} must be an object.`);
    return;
  }
  if (!option.label || option.label.length > 100) {
    issues.push(`${path}.label must be 1-100 characters.`);
  }
  if (!option.value || option.value.length > 100) {
    issues.push(`${path}.value must be 1-100 characters.`);
  }
  if (option.description && option.description.length > 100) {
    issues.push(`${path}.description must be 100 characters or fewer.`);
  }
}

function validateComponent(component, path, issues, { inModal = false } = {}) {
  if (!component || typeof component !== 'object') {
    issues.push(`${path} must be an object.`);
    return;
  }

  if (component.custom_id && component.custom_id.length > 100) {
    issues.push(`${path}.custom_id must be 100 characters or fewer.`);
  }

  if (component.type === 2) {
    if (!component.style) issues.push(`${path}.style is required for buttons.`);
    if (!component.label || component.label.length > 80) {
      issues.push(`${path}.label must be 1-80 characters for buttons.`);
    }
    return;
  }

  if (component.type === 3) {
    if (inModal) {
      issues.push(`${path} uses a string select inside a modal, which Discord does not support.`);
    }
    if (!Array.isArray(component.options) || component.options.length < 1 || component.options.length > 25) {
      issues.push(`${path}.options must contain 1-25 select options.`);
    } else {
      component.options.forEach((option, index) => validateSelectOption(option, `${path}.options[${index}]`, issues));
    }
    if (component.placeholder && component.placeholder.length > 150) {
      issues.push(`${path}.placeholder must be 150 characters or fewer.`);
    }
    return;
  }

  if (component.type === 4) {
    if (!component.label || component.label.length > 45) {
      issues.push(`${path}.label must be 1-45 characters for text inputs.`);
    }
    if (!component.style) {
      issues.push(`${path}.style is required for text inputs.`);
    }
    return;
  }

  issues.push(`${path}.type ${component.type} is not supported by the local validator.`);
}

function validateActionRows(rows, issues, { inModal = false } = {}) {
  if (!Array.isArray(rows)) return;

  if (rows.length > 5) {
    issues.push(`components has ${rows.length} rows; Discord allows at most 5.`);
  }

  rows.forEach((row, rowIndex) => {
    const rowPath = `components[${rowIndex}]`;
    if (!row || row.type !== 1) {
      issues.push(`${rowPath} must be an action row.`);
      return;
    }

    const components = row.components || [];
    if (components.length < 1 || components.length > 5) {
      issues.push(`${rowPath}.components must contain 1-5 components.`);
    }

    if (inModal) {
      if (components.length !== 1) {
        issues.push(`${rowPath}.components must contain exactly 1 component in modals.`);
      }
      if (components[0]?.type !== 4) {
        issues.push(`${rowPath} must contain a text input in modals.`);
      }
    } else {
      const hasNonButtons = components.some(component => component.type !== 2);
      if (hasNonButtons && components.length !== 1) {
        issues.push(`${rowPath} cannot mix or group non-button components; select menus must be alone in their row.`);
      }
    }

    components.forEach((component, componentIndex) => {
      validateComponent(component, `${rowPath}.components[${componentIndex}]`, issues, { inModal });
    });
  });
}

function validateInitialResponse(response) {
  const issues = [];

  if (!response || typeof response !== 'object') {
    return ['Initial response must be an object.'];
  }

  if (response.type === 9) {
    validateActionRows(response.data?.components, issues, { inModal: true });
  }

  if ([4, 7].includes(response.type)) {
    validateActionRows(response.data?.components, issues, { inModal: false });
  }

  return issues;
}

function hexToUint8Array(value) {
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < value.length; i += 2) {
    bytes[i / 2] = parseInt(value.slice(i, i + 2), 16);
  }
  return bytes;
}

async function verifyDiscordSignature({ body, signature, timestamp, publicKey }) {
  const key = await crypto.subtle.importKey(
    'raw',
    hexToUint8Array(publicKey),
    { name: 'Ed25519' },
    false,
    ['verify']
  );

  const payload = new TextEncoder().encode(`${timestamp}${body}`);
  return crypto.subtle.verify('Ed25519', key, hexToUint8Array(signature), payload);
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function hydrateMemberRoles(interaction, env) {
  const roleIds = interaction.raw.member?.roles || [];
  if (!roleIds.length) return;

  const cachedRoles = interaction.member?.roles?.cache || [];
  const hasRoleNames = cachedRoles.length > 0 && cachedRoles.every(role => role.name);
  if (hasRoleNames) return;

  if (!env.DISCORD_TOKEN) {
    throw new Error('DISCORD_TOKEN is required at runtime to resolve Discord role names for permission checks.');
  }

  if (!interaction.raw.guild_id) {
    throw new Error('Guild context is required to resolve Discord role names for permission checks.');
  }

  let roleMap = guildRoleCache.get(interaction.raw.guild_id);
  if (!roleMap) {
    const response = await fetch(`https://discord.com/api/v10/guilds/${interaction.raw.guild_id}/roles`, {
      headers: {
        Authorization: `Bot ${env.DISCORD_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch guild roles (${response.status})`);
    }

    const roles = await response.json();
    roleMap = new Map(roles.map(role => [role.id, { id: role.id, name: role.name }]));
    guildRoleCache.set(interaction.raw.guild_id, roleMap);
  }

  interaction.member.roles.cache = roleIds.map(roleId => roleMap.get(roleId) || ({ id: roleId, name: roleId }));
}

async function dispatchInteraction(interaction) {
  logDebug(interaction.env, '[discord] Dispatching interaction', {
    interaction: summarizeInteraction(interaction.raw),
  });

  await hydrateMemberRoles(interaction, interaction.env);

  if (interaction.isModalSubmit()) {
    if (isShinyEditModal(interaction.customId)) {
      await handleShinyEditModal(interaction);
      return;
    }
    throw new Error(`Unhandled modal: ${interaction.customId}`);
  }

  if (interaction.isMessageComponent()) {
    if (isShinyComponent(interaction.customId)) {
      await handleShinyComponent(interaction);
      return;
    }
    throw new Error(`Unhandled component: ${interaction.customId}`);
  }

  if (!interaction.isChatInputCommand()) {
    throw new Error('Unsupported interaction type.');
  }

  const requiredRoles = getCommandRequiredRoles(interaction.commandName);
  const permissionResult = await checkCommandPermission(interaction, requiredRoles, interaction.commandName);

  if (!permissionResult.allowed) {
    await interaction.reply({
      content: `❌ ${permissionResult.reason}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const handler = getCommandHandler(interaction.commandName);
  await handler(interaction);
}

async function handleInteractionRequest(request, env = process.env, executionContext) {
  if (request.method === 'GET') {
    return jsonResponse({
      success: true,
      message: 'Team Soju Discord interaction worker is running',
      timestamp: new Date().toISOString(),
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  validateEnvironment(['DISCORD_CLIENT_ID', 'DISCORD_PUBLIC_KEY', 'DISCORD_TOKEN']);

  const body = await request.text();
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');

  if (!signature || !timestamp) {
    return new Response('Missing Discord signature headers', { status: 401 });
  }

  const verified = await verifyDiscordSignature({
    body,
    signature,
    timestamp,
    publicKey: env.DISCORD_PUBLIC_KEY,
  });

  if (!verified) {
    return new Response('Invalid request signature', { status: 401 });
  }

  const rawInteraction = JSON.parse(body);
  logDebug(env, '[discord] Received interaction request', {
    interaction: summarizeInteraction(rawInteraction),
    request: {
      method: request.method,
      userAgent: request.headers.get('user-agent'),
    },
  });

  if (rawInteraction.type === 1) {
    return jsonResponse({ type: 1 });
  }

  const interaction = new DiscordInteractionContext(rawInteraction, env);
  const execution = dispatchInteraction(interaction).catch(async error => {
    logError('Discord interaction failed:', error, {
      interaction: summarizeInteraction(rawInteraction),
    });
    const payload = {
      content: `Error: ${error.message || 'Command execution failed'}`,
      flags: MessageFlags.Ephemeral,
    };

    if (interaction.initialResponse) {
      await interaction.followUp(payload).catch(err => logError('Discord followUp failed:', err, {
        interaction: summarizeInteraction(rawInteraction),
      }));
    } else {
      interaction.setInitialResponse({ type: 4, data: payload });
    }
  });

  const initialResponse = await interaction.initialResponsePromise;
  const validationIssues = validateInitialResponse(initialResponse);
  if (validationIssues.length > 0) {
    logError('Discord interaction response failed local validation:', null, {
      interaction: summarizeInteraction(rawInteraction),
      issues: validationIssues,
      response: initialResponse,
    });
  }

  logDebug(env, '[discord] Initial interaction response', {
    interaction: summarizeInteraction(rawInteraction),
    response: summarizeInitialResponse(initialResponse),
  });
  logDebug(env, '[discord] Initial interaction response body', initialResponse);

  if (executionContext?.waitUntil) {
    executionContext.waitUntil(execution);
  } else {
    await execution;
  }

  return jsonResponse(initialResponse);
}

async function registerCommandsIfNeeded(env = process.env) {
  if (env.REGISTER_COMMANDS_ON_START !== 'true') {
    return false;
  }

  validateEnvironment(['DISCORD_CLIENT_ID', 'DISCORD_TOKEN']);
  await registerSlashCommands(
    COMMANDS,
    env.DISCORD_CLIENT_ID,
    env.DISCORD_TOKEN,
    env.DISCORD_GUILD_ID
  );
  return true;
}

module.exports = {
  fetch: handleInteractionRequest,
  handleInteractionRequest,
  registerCommandsIfNeeded,
};
