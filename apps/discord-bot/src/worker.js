const path = require('path');
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
}

const { COMMANDS } = require('./commands');
const {
  registerSlashCommands,
  getCommandHandler,
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
  if (rawInteraction.type === 1) {
    return jsonResponse({ type: 1 });
  }

  const interaction = new DiscordInteractionContext(rawInteraction, env);
  const execution = dispatchInteraction(interaction).catch(async error => {
    console.error('Discord interaction failed:', error);
    const payload = {
      content: `Error: ${error.message || 'Command execution failed'}`,
      flags: MessageFlags.Ephemeral,
    };

    if (interaction.initialResponse) {
      await interaction.followUp(payload).catch(err => console.error('Discord followUp failed:', err));
    } else {
      interaction.setInitialResponse({ type: 4, data: payload });
    }
  });

  const initialResponse = await interaction.initialResponsePromise;
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
