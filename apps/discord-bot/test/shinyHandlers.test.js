/**
 * Tests for shiny command handlers (pagination behavior)
 */

// create simple mocks for the discord.js builders used in the handlers
class MockEmbedBuilder {
  constructor() {
    this.fields = [];
  }
  setColor() { return this; }
  setTitle() { return this; }
  setDescription() { return this; }
  setFooter() { return this; }
  setTimestamp() { return this; }
  addFields() { return this; }
}

class MockButtonBuilder {
  setCustomId() { return this; }
  setLabel() { return this; }
  setStyle() { return this; }
  setDisabled() { return this; }
}

class MockActionRowBuilder {
  addComponents() { return this; }
}

const ButtonStyle = { Primary: 'PRIMARY' };

jest.mock('discord.js', () => ({
  EmbedBuilder: MockEmbedBuilder,
  ButtonBuilder: MockButtonBuilder,
  ActionRowBuilder: MockActionRowBuilder,
  ButtonStyle,
  codeBlock: jest.fn(s => s)
}));

jest.mock('axios');
// avoid importing the real pokeapi (uses ESM export syntax) during tests
jest.mock('../../../../packages/utils/pokeapi', () => ({
  getNationalNumber: jest.fn(),
  getSpriteUrl: jest.fn()
}));

const { handleGetShinies } = require('../src/handlers/shinyHandlers');
const { createMockInteraction } = require('./fixtures/mockInteraction');
const axios = require('axios');

describe('shinyHandlers pagination', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should request all shinies and include components when results exceed page size', async () => {
    const interaction = createMockInteraction({
      options: { trainer: 'tester', limit: 2 }
    });

    // stub trainer lookup
    axios.get
      .mockResolvedValueOnce({ data: { data: { id: 'trainer-id' } } }) // trainers/ign
      .mockResolvedValueOnce({ data: { data: [
          { pokemon_name: 'A', trainer_name: 'T1', is_secret: false, id: '1' },
          { pokemon_name: 'B', trainer_name: 'T2', is_secret: false, id: '2' },
          { pokemon_name: 'C', trainer_name: 'T3', is_secret: false, id: '3' }
        ] } });

    await handleGetShinies(interaction);

    expect(axios.get).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3001/api/members/ign/tester',
      expect.any(Object)
    );

    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/shinies?'),
      expect.any(Object)
    );

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        components: expect.any(Array)
      })
    );
  });

  it('should handle no shinies gracefully', async () => {
    const interaction = createMockInteraction({
      options: { limit: 5 }
    });

    axios.get.mockResolvedValueOnce({ data: { data: [] } });

    await handleGetShinies(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'No shinies found' })
    );
  });

  it('should handle API errors properly', async () => {
    const interaction = createMockInteraction({ options: {} });
    axios.get.mockRejectedValue(new Error('boom'));

    await handleGetShinies(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Error') })
    );
  });
});
