const ApplicationCommandOptionType = {
  String: 3,
  Integer: 4,
  Boolean: 5,
  User: 6,
  Attachment: 11,
};

const ComponentType = {
  ActionRow: 1,
  Button: 2,
  StringSelect: 3,
  TextInput: 4,
};

const ButtonStyle = {
  Primary: 1,
  Secondary: 2,
  Danger: 4,
};

const TextInputStyle = {
  Short: 1,
  Paragraph: 2,
};

const MessageFlags = {
  Ephemeral: 1 << 6,
};

function toJSON(value) {
  if (value && typeof value.toJSON === 'function') {
    return value.toJSON();
  }
  return value;
}

class SlashCommandOptionBuilder {
  constructor(type) {
    this.data = { type };
  }

  setName(name) {
    this.data.name = name;
    return this;
  }

  setDescription(description) {
    this.data.description = description;
    return this;
  }

  setRequired(required) {
    this.data.required = required;
    return this;
  }

  addChoices(...choices) {
    this.data.choices = choices;
    return this;
  }

  toJSON() {
    return { ...this.data };
  }
}

class SlashCommandBuilder {
  constructor() {
    this.data = {
      type: 1,
      options: [],
    };
  }

  setName(name) {
    this.data.name = name;
    return this;
  }

  setDescription(description) {
    this.data.description = description;
    return this;
  }

  addOption(type, callback) {
    const option = new SlashCommandOptionBuilder(type);
    callback(option);
    this.data.options.push(option.toJSON());
    return this;
  }

  addStringOption(callback) {
    return this.addOption(ApplicationCommandOptionType.String, callback);
  }

  addIntegerOption(callback) {
    return this.addOption(ApplicationCommandOptionType.Integer, callback);
  }

  addBooleanOption(callback) {
    return this.addOption(ApplicationCommandOptionType.Boolean, callback);
  }

  addUserOption(callback) {
    return this.addOption(ApplicationCommandOptionType.User, callback);
  }

  addAttachmentOption(callback) {
    return this.addOption(ApplicationCommandOptionType.Attachment, callback);
  }

  toJSON() {
    return {
      ...this.data,
      options: this.data.options.map(option => ({ ...option })),
    };
  }
}

class EmbedBuilder {
  constructor(data = {}) {
    this.data = {
      ...data,
      fields: data.fields ? [...data.fields] : [],
    };
  }

  setColor(color) {
    this.data.color = color;
    return this;
  }

  setTitle(title) {
    this.data.title = title;
    return this;
  }

  setDescription(description) {
    this.data.description = description;
    return this;
  }

  addFields(...fields) {
    const normalized = fields.flat().map(field => ({ ...field }));
    this.data.fields.push(...normalized);
    return this;
  }

  setFooter(footer) {
    this.data.footer = footer;
    return this;
  }

  setTimestamp(timestamp = new Date().toISOString()) {
    this.data.timestamp = typeof timestamp === 'string' ? timestamp : new Date(timestamp).toISOString();
    return this;
  }

  setThumbnail(url) {
    this.data.thumbnail = { url };
    return this;
  }

  setImage(url) {
    this.data.image = { url };
    return this;
  }

  toJSON() {
    return {
      ...this.data,
      fields: this.data.fields.map(field => ({ ...field })),
    };
  }
}

class ActionRowBuilder {
  constructor() {
    this.components = [];
  }

  addComponents(...components) {
    this.components.push(...components.map(toJSON));
    return this;
  }

  toJSON() {
    return {
      type: ComponentType.ActionRow,
      components: this.components.map(component => ({ ...component })),
    };
  }
}

class ButtonBuilder {
  constructor() {
    this.data = { type: ComponentType.Button };
  }

  setCustomId(customId) {
    this.data.custom_id = customId;
    return this;
  }

  setLabel(label) {
    this.data.label = label;
    return this;
  }

  setStyle(style) {
    this.data.style = style;
    return this;
  }

  setDisabled(disabled) {
    this.data.disabled = disabled;
    return this;
  }

  toJSON() {
    return { ...this.data };
  }
}

class StringSelectMenuBuilder {
  constructor() {
    this.data = {
      type: ComponentType.StringSelect,
      options: [],
    };
  }

  setCustomId(customId) {
    this.data.custom_id = customId;
    return this;
  }

  setPlaceholder(placeholder) {
    this.data.placeholder = placeholder;
    return this;
  }

  setMinValues(minValues) {
    this.data.min_values = minValues;
    return this;
  }

  setMaxValues(maxValues) {
    this.data.max_values = maxValues;
    return this;
  }

  setDisabled(disabled) {
    this.data.disabled = disabled;
    return this;
  }

  addOptions(options) {
    this.data.options.push(...options.map(option => ({ ...option })));
    return this;
  }

  toJSON() {
    return {
      ...this.data,
      options: this.data.options.map(option => ({ ...option })),
    };
  }
}

class TextInputBuilder {
  constructor() {
    this.data = { type: ComponentType.TextInput };
  }

  setCustomId(customId) {
    this.data.custom_id = customId;
    return this;
  }

  setLabel(label) {
    this.data.label = label;
    return this;
  }

  setStyle(style) {
    this.data.style = style;
    return this;
  }

  setRequired(required) {
    this.data.required = required;
    return this;
  }

  setValue(value) {
    this.data.value = value;
    return this;
  }

  setPlaceholder(placeholder) {
    this.data.placeholder = placeholder;
    return this;
  }

  toJSON() {
    return { ...this.data };
  }
}

class ModalBuilder {
  constructor() {
    this.data = {
      components: [],
    };
  }

  setCustomId(customId) {
    this.data.custom_id = customId;
    return this;
  }

  setTitle(title) {
    this.data.title = title;
    return this;
  }

  addComponents(...rows) {
    this.data.components.push(...rows.map(toJSON));
    return this;
  }

  toJSON() {
    return {
      ...this.data,
      components: this.data.components.map(component => ({ ...component })),
    };
  }
}

function codeBlock(value) {
  return `\`\`\`\n${value}\n\`\`\``;
}

module.exports = {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  codeBlock,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  toJSON,
};
