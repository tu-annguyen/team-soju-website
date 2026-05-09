const { toJSON } = require('./api');

const DISCORD_API_BASE_URL = 'https://discord.com/api/v10';
const DISCORD_API_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 250;

const InteractionResponseType = {
  Pong: 1,
  ChannelMessageWithSource: 4,
  ApplicationCommandAutocompleteResult: 8,
  DeferredChannelMessageWithSource: 5,
  DeferredUpdateMessage: 6,
  UpdateMessage: 7,
  Modal: 9,
};

function serializePayload(payload = {}) {
  return {
    ...payload,
    embeds: payload.embeds?.map(embed => toJSON(embed)),
    components: payload.components?.map(component => toJSON(component)),
  };
}

function toRoleCache(member, resolved) {
  const roleIds = member?.roles || [];
  const roles = resolved?.roles || {};
  return roleIds
    .map(roleId => roles[roleId])
    .filter(Boolean)
    .map(role => ({ id: role.id, name: role.name }));
}

function buildOptionsAccessor(data, resolved) {
  const options = data?.options || [];
  const optionsByName = new Map(options.map(option => [option.name, option]));

  function findFocusedOption(entries = []) {
    for (const entry of entries) {
      if (entry?.focused) {
        return entry;
      }
      if (Array.isArray(entry?.options)) {
        const nested = findFocusedOption(entry.options);
        if (nested) return nested;
      }
    }
    return null;
  }

  const focusedOption = findFocusedOption(options);

  return {
    getString(name) {
      return optionsByName.get(name)?.value ?? null;
    },
    getInteger(name) {
      const value = optionsByName.get(name)?.value;
      return value ?? null;
    },
    getBoolean(name) {
      const value = optionsByName.get(name)?.value;
      return value ?? null;
    },
    getUser(name) {
      const option = optionsByName.get(name);
      if (!option?.value) return null;
      return resolved?.users?.[option.value] || null;
    },
    getAttachment(name) {
      const option = optionsByName.get(name);
      if (!option?.value) return null;
      return resolved?.attachments?.[option.value] || null;
    },
    getFocused(required = false) {
      if (!focusedOption) {
        return required ? '' : null;
      }
      return focusedOption.value ?? '';
    },
    getFocusedOption() {
      return focusedOption ? { ...focusedOption } : null;
    },
  };
}

function buildFieldsAccessor(data) {
  const values = new Map();
  const rows = data?.components || [];

  rows.forEach(row => {
    (row.components || []).forEach(component => {
      values.set(component.custom_id, component.value || component.values?.[0] || '');
    });
  });

  return {
    getTextInputValue(name) {
      return values.get(name) || '';
    },
  };
}

function parseDiscordApiError(body) {
  try {
    return JSON.parse(body);
  } catch (_error) {
    return null;
  }
}

function isRetryableDiscordStatus(status) {
  return status === 429 || status >= 500;
}

function getRetryDelayMs(response, attempt) {
  const retryAfterSeconds = Number.parseFloat(response?.headers?.get?.('retry-after') || '');
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  return DEFAULT_RETRY_DELAY_MS * attempt;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class DiscordInteractionContext {
  constructor(interaction, env) {
    this.raw = interaction;
    this.env = env;
    this.applicationId = interaction.application_id || env.DISCORD_CLIENT_ID;
    this.token = interaction.token;
    this.commandName = interaction.data?.name;
    this.customId = interaction.data?.custom_id;
    this.user = interaction.member?.user || interaction.user;
    this.member = {
      ...interaction.member,
      roles: {
        cache: toRoleCache(interaction.member, interaction.data?.resolved || interaction.resolved),
      },
    };
    this.options = buildOptionsAccessor(interaction.data, interaction.data?.resolved || interaction.resolved);
    this.fields = buildFieldsAccessor(interaction.data);
    this.values = interaction.data?.values || [];
    this.deferred = false;
    this.replied = false;
    this.initialResponse = null;
    this._resolveInitial = null;
    this.initialResponsePromise = new Promise(resolve => {
      this._resolveInitial = resolve;
    });
  }

  isChatInputCommand() {
    return this.raw.type === 2;
  }

  isAutocomplete() {
    return this.raw.type === 4;
  }

  isModalSubmit() {
    return this.raw.type === 5;
  }

  isMessageComponent() {
    return this.raw.type === 3;
  }

  setInitialResponse(response) {
    if (!this.initialResponse) {
      this.initialResponse = response;
      this._resolveInitial(response);
    }
    return response;
  }

  async deferReply(options = {}) {
    this.deferred = true;
    this.setInitialResponse({
      type: InteractionResponseType.DeferredChannelMessageWithSource,
      data: options.flags ? { flags: options.flags } : {},
    });
  }

  async reply(payload = {}) {
    const data = serializePayload(payload);

    if (!this.initialResponse) {
      this.replied = true;
      this.setInitialResponse({
        type: InteractionResponseType.ChannelMessageWithSource,
        data,
      });
      return;
    }

    if (this.initialResponse.type === InteractionResponseType.DeferredChannelMessageWithSource) {
      this.replied = true;
      await this.editReply(data);
      return;
    }

    await this.followUp(data);
  }

  async editReply(payload = {}) {
    const data = serializePayload(payload);

    if (!this.initialResponse) {
      this.replied = true;
      this.setInitialResponse({
        type: InteractionResponseType.ChannelMessageWithSource,
        data,
      });
      return;
    }

    await this.discordRequest(`/webhooks/${this.applicationId}/${this.token}/messages/@original`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async followUp(payload = {}) {
    await this.discordRequest(`/webhooks/${this.applicationId}/${this.token}`, {
      method: 'POST',
      body: JSON.stringify(serializePayload(payload)),
    });
  }

  async update(payload = {}) {
    this.replied = true;
    this.setInitialResponse({
      type: InteractionResponseType.UpdateMessage,
      data: serializePayload(payload),
    });
  }

  async showModal(modal) {
    this.replied = true;
    this.setInitialResponse({
      type: InteractionResponseType.Modal,
      data: toJSON(modal),
    });
  }

  async respondAutocomplete(choices = []) {
    this.replied = true;
    this.setInitialResponse({
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: {
        choices: choices.map(choice => ({ ...choice })),
      },
    });
  }

  async discordRequest(path, init) {
    for (let attempt = 1; attempt <= DISCORD_API_MAX_RETRIES; attempt += 1) {
      let response;

      try {
        response = await fetch(`${DISCORD_API_BASE_URL}${path}`, {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            ...(init.headers || {}),
          },
        });
      } catch (error) {
        if (attempt < DISCORD_API_MAX_RETRIES) {
          await wait(DEFAULT_RETRY_DELAY_MS * attempt);
          continue;
        }

        throw new Error(
          'Discord is temporarily unavailable, so the bot could not send its response. Please try again in a moment.'
        );
      }
      if (response.ok) {
        return;
      }

      const body = await response.text();
      const parsedError = parseDiscordApiError(body);
      if (parsedError?.code === 10015) {
        throw new Error(
          `Discord interaction webhook is no longer valid (code 10015). ` +
          'This usually means the interaction token expired before a follow-up/edit was sent.'
        );
      }

      if (isRetryableDiscordStatus(response.status) && attempt < DISCORD_API_MAX_RETRIES) {
        await wait(getRetryDelayMs(response, attempt));
        continue;
      }

      if (isRetryableDiscordStatus(response.status)) {
        throw new Error(
          `Discord is temporarily unavailable (${response.status}), so the bot could not send its response. Please try again in a moment.`
        );
      }

      throw new Error(`Discord API request failed (${response.status}): ${body}`);
    }
  }
}

module.exports = {
  DiscordInteractionContext,
  InteractionResponseType,
};
