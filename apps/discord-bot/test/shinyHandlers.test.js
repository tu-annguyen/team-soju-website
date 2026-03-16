/**
 * Tests for shiny command handlers
 */

class MockEmbedBuilder {
  constructor() {
    this.fields = [];
  }
  setColor() { return this; }
  setTitle() { return this; }
  setDescription() { return this; }
  setFooter() { return this; }
  setTimestamp() { return this; }
  setThumbnail() { return this; }
  setImage() { return this; }
  addFields() { return this; }
}

class MockButtonBuilder {
  setCustomId(value) { this.customId = value; return this; }
  setLabel(value) { this.label = value; return this; }
  setStyle(value) { this.style = value; return this; }
  setDisabled(value) { this.disabled = value; return this; }
}

class MockStringSelectMenuBuilder {
  setCustomId(value) { this.customId = value; return this; }
  setPlaceholder(value) { this.placeholder = value; return this; }
  setMinValues(value) { this.minValues = value; return this; }
  setMaxValues(value) { this.maxValues = value; return this; }
  setDisabled(value) { this.disabled = value; return this; }
  addOptions(value) { this.options = value; return this; }
}

class MockActionRowBuilder {
  constructor() {
    this.components = [];
  }
  addComponents(...components) {
    this.components.push(...components);
    return this;
  }
}

class MockModalBuilder {
  setCustomId() { return this; }
  setTitle() { return this; }
  addComponents() { return this; }
}

class MockTextInputBuilder {
  setCustomId() { return this; }
  setLabel() { return this; }
  setStyle() { return this; }
  setRequired() { return this; }
  setValue() { return this; }
}

const ButtonStyle = {
  Primary: 'PRIMARY',
  Secondary: 'SECONDARY',
  Danger: 'DANGER',
};

const TextInputStyle = {
  Short: 'SHORT',
};

jest.mock('discord.js', () => ({
  EmbedBuilder: MockEmbedBuilder,
  ButtonBuilder: MockButtonBuilder,
  StringSelectMenuBuilder: MockStringSelectMenuBuilder,
  ActionRowBuilder: MockActionRowBuilder,
  ModalBuilder: MockModalBuilder,
  TextInputBuilder: MockTextInputBuilder,
  ButtonStyle,
  TextInputStyle,
  codeBlock: jest.fn(s => s),
}));

jest.mock('axios');

jest.mock('@team-soju/utils', () => ({
  capitalize: jest.fn((value) => {
    const normalized = String(value || '').trim();
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase() : normalized;
  }),
  greyscale: jest.fn(),
  getSpriteUrl: jest.fn(),
  getNationalNumber: jest.fn(),
}));

const axios = require('axios');
const localUtils = require('../src/utils');
const {
  handleGetShinies,
  handleGetMyShinies,
  handleGetShiny,
  handleShinyEditModal,
} = require('../src/handlers/shinyHandlers');
const { createMockInteraction } = require('./fixtures/mockInteraction');

const validateSojuTrainerIGNSpy = jest.spyOn(localUtils, 'validateSojuTrainerIGN').mockResolvedValue({ valid: true });

describe('shinyHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validateSojuTrainerIGNSpy.mockResolvedValue({ valid: true });
  });

  it('renders shinies with interaction components', async () => {
    const interaction = createMockInteraction({
      options: { trainer: 'tester', limit: 2 },
    });

    axios.get
      .mockResolvedValueOnce({ data: { data: { id: 'trainer-id' } } })
      .mockResolvedValueOnce({
        data: {
          data: [
            { id: '1', pokemon_name: 'A', trainer_name: 'T1', catch_date: '2026-01-03', total_encounters: 1 },
            { id: '2', pokemon_name: 'B', trainer_name: 'T2', catch_date: '2026-01-02', total_encounters: 2 },
            { id: '3', pokemon_name: 'C', trainer_name: 'T3', catch_date: '2026-01-01', total_encounters: 3 },
          ],
        },
      });

    await handleGetShinies(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        components: expect.any(Array),
      })
    );
  });

  it('disables edit, fail, and delete buttons for public /shinies users', async () => {
    const interaction = createMockInteraction({
      options: { trainer: null, limit: 2 },
      member: { roles: { cache: [] } },
    });

    axios.get.mockResolvedValueOnce({
      data: {
        data: [
          { id: '1', pokemon_name: 'A', trainer_name: 'T1', catch_date: '2026-01-03', total_encounters: 1 },
        ],
      },
    });

    await handleGetShinies(interaction);

    const replyPayload = interaction.editReply.mock.calls[0][0];
    const actionButtons = replyPayload.components[2].components;

    expect(actionButtons).toHaveLength(1);
    expect(actionButtons.find(button => button.customId === 'shiny_action_view').disabled).toBe(false);
    expect(actionButtons.find(button => button.customId === 'shiny_action_edit')).toBeUndefined();
    expect(actionButtons.find(button => button.customId === 'shiny_action_fail')).toBeUndefined();
    expect(actionButtons.find(button => button.customId === 'shiny_action_delete')).toBeUndefined();
  });

  it('renders linked member shinies for myshinies', async () => {
    const interaction = createMockInteraction({
      user: { id: 'discord-user' },
      options: { limit: 5 },
    });

    axios.get
      .mockResolvedValueOnce({ data: { data: { id: 'trainer-id', ign: 'Tester' } } })
      .mockResolvedValueOnce({
        data: {
          data: [{ id: '1', pokemon_name: 'A', trainer_name: 'Tester', catch_date: '2026-01-03', total_encounters: 1 }],
        },
      });

    await handleGetMyShinies(interaction);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(axios.get).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3001/api/members/discord/discord-user',
      expect.any(Object)
    );
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        components: expect.any(Array),
      })
    );
  });

  it('returns an error when myshinies user is not linked', async () => {
    const interaction = createMockInteraction({
      user: { id: 'discord-user' },
      options: { limit: 5 },
    });

    axios.get.mockRejectedValue({ response: { status: 404 } });

    await handleGetMyShinies(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Your Discord account is not linked to a team member.',
      })
    );
  });

  it('attaches a greyscaled sprite for failed shinies', async () => {
    const { greyscale, getSpriteUrl } = require('@team-soju/utils');
    const interaction = createMockInteraction({ options: { id: 'abc' } });

    axios.get.mockResolvedValueOnce({
      data: {
        data: {
          id: 'abc',
          national_number: 1,
          pokemon: 'Testmon',
          pokemon_name: 'Testmon',
          trainer_name: 'T1',
          catch_date: '2020-01-01',
          notes: 'Failed',
          is_secret: false,
          is_alpha: false,
        },
      },
    });
    getSpriteUrl.mockResolvedValue('http://example.com/sprite.gif');
    greyscale.mockResolvedValue(Buffer.from('grey'));

    await handleGetShiny(interaction);

    expect(getSpriteUrl).toHaveBeenCalledWith(1);
    expect(greyscale).toHaveBeenCalledWith('http://example.com/sprite.gif');
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        files: expect.any(Array),
      })
    );
  });

  it('updates a shiny from the edit modal', async () => {
    const interaction = {
      customId: 'shiny_modal_edit:abc',
      user: { id: 'discord-user', tag: 'User#0001' },
      member: { roles: { cache: [{ name: 'Elite 4' }] } },
      fields: {
        getTextInputValue: jest.fn((field) => ({
          pokemon: 'pikachu',
          catch_date: '2026-02-01',
          encounter_type: 'horde',
          encounters: '100,20',
          ivs: '1,2,3,4,5,6',
        }[field] || '')),
      },
      reply: jest.fn().mockResolvedValue(undefined),
    };

    axios.get
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'abc',
            national_number: 25,
            pokemon: 'pikachu',
            pokemon_name: 'pikachu',
            trainer_name: 'Tester',
            catch_date: '2026-01-01',
            encounter_type: 'single',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'abc',
            national_number: 25,
            pokemon: 'pikachu',
            pokemon_name: 'pikachu',
            trainer_name: 'Tester',
            catch_date: '2026-02-01',
            encounter_type: 'horde',
            total_encounters: 100,
            species_encounters: 20,
            iv_hp: 1,
            iv_attack: 2,
            iv_defense: 3,
            iv_sp_attack: 4,
            iv_sp_defense: 5,
            iv_speed: 6,
          },
        },
      });

    axios.put.mockResolvedValueOnce({
      data: {
        data: {
          id: 'abc',
          national_number: 25,
          pokemon: 'pikachu',
          pokemon_name: 'pikachu',
          trainer_name: 'Tester',
          catch_date: '2026-02-01',
          encounter_type: 'horde',
          total_encounters: 100,
          species_encounters: 20,
          iv_hp: 1,
          iv_attack: 2,
          iv_defense: 3,
          iv_sp_attack: 4,
          iv_sp_defense: 5,
          iv_speed: 6,
        },
      },
    });

    const { getNationalNumber, getSpriteUrl } = require('@team-soju/utils');
    getNationalNumber.mockResolvedValue(25);
    getSpriteUrl.mockResolvedValue('http://example.com/sprite.gif');

    await handleShinyEditModal(interaction);

    expect(axios.put).toHaveBeenCalledWith(
      'http://localhost:3001/api/shinies/abc',
      expect.objectContaining({
        pokemon: 'pikachu',
        national_number: 25,
        catch_date: '2026-02-01',
        encounter_type: 'horde',
        total_encounters: 100,
        species_encounters: 20,
        iv_hp: 1,
        iv_attack: 2,
        iv_defense: 3,
        iv_sp_attack: 4,
        iv_sp_defense: 5,
        iv_speed: 6,
      }),
      expect.any(Object)
    );
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        ephemeral: true,
      })
    );
  });

  it('blocks public users from editing shinies from the modal', async () => {
    const interaction = {
      customId: 'shiny_modal_edit:abc',
      user: { id: 'discord-user', tag: 'User#0001' },
      member: { roles: { cache: [] } },
      fields: {
        getTextInputValue: jest.fn(() => ''),
      },
      reply: jest.fn().mockResolvedValue(undefined),
    };

    axios.get.mockResolvedValueOnce({
      data: {
        data: {
          id: 'abc',
          national_number: 25,
          pokemon: 'pikachu',
          pokemon_name: 'pikachu',
          trainer_name: 'AnotherTrainer',
        },
      },
    });

    await handleShinyEditModal(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('You need one of these roles to manage shinies'),
        ephemeral: true,
      })
    );
  });
});
