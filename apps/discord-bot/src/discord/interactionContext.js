const { toJSON } = require('./api');

const InteractionResponseType = {
  Pong: 1,
  ChannelMessageWithSource: 4,
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
  };
}

function buildFieldsAccessor(data) {
  const values = new Map();
  const rows = data?.components || [];

  rows.forEach(row => {
    (row.components || []).forEach(component => {
      values.set(component.custom_id, component.value || '');
    });
  });

  return {
    getTextInputValue(name) {
      return values.get(name) || '';
    },
  };
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

  async discordRequest(path, init) {
    const response = await fetch(`https://discord.com/api/v10${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Discord API request failed (${response.status}): ${body}`);
    }
  }
}

module.exports = {
  DiscordInteractionContext,
  InteractionResponseType,
};
