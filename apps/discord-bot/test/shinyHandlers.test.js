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
  setThumbnail() { return this; }
  setImage() { return this; }
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

// mock the utils package as a whole so we can stub greyscale
jest.mock('@team-soju/utils', () => ({
  getNationalNumber: jest.fn(),
  getSpriteUrl: jest.fn(),
  greyscale: jest.fn()
}));

const { handleGetShinies, handleGetShiny, handleFailShiny } = require('../src/handlers/shinyHandlers');
const localUtils = require('../src/utils');

// always allow trainer validation in tests
jest.spyOn(localUtils, 'validateSojuTrainerIGN').mockResolvedValue({ valid: true });
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
      options: { limit: 5, trainer: null }
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

  describe('handleGetShiny greyscale behaviour', () => {
    it('should attach greyscale sprite when shiny notes indicate failed', async () => {
      const { greyscale, getSpriteUrl } = require('@team-soju/utils');
      const interaction = createMockInteraction({ options: { id: 'abc' } });

      const fakeShiny = {
        national_number: 1,
        pokemon: 'Testmon',
        trainer_name: 'T1',
        catch_date: '2020-01-01',
        notes: 'Failed',
        is_secret: false
      };

      // stub API call for fetching shiny
      axios.get.mockResolvedValueOnce({ data: { data: fakeShiny } });
      getSpriteUrl.mockResolvedValue('http://example.com/sprite.gif');
      greyscale.mockResolvedValue(Buffer.from('grey')); // dummy greyscale output

      await handleGetShiny(interaction);

      expect(getSpriteUrl).toHaveBeenCalledWith(fakeShiny.national_number);
      expect(greyscale).toHaveBeenCalledWith('http://example.com/sprite.gif');

      // expect editReply called with files array containing our buffer
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
          files: expect.any(Array)
        })
      );
    });

    it('should not call greyscale when shiny is not failed', async () => {
      const { greyscale, getSpriteUrl } = require('@team-soju/utils');
      const interaction = createMockInteraction({ options: { id: 'xyz' } });

      const fakeShiny = { national_number: 2, pokemon: 'Foo', notes: null };
      axios.get.mockResolvedValueOnce({ data: { data: fakeShiny } });
      getSpriteUrl.mockResolvedValue('http://example.com/sprite.gif');

      await handleGetShiny(interaction);

      expect(greyscale).not.toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array) })
      );
    });
  });

  describe('handleFailShiny greyscale behaviour', () => {
    it('should greyscale the sprite when marking a shiny as failed', async () => {
      const { greyscale, getSpriteUrl } = require('@team-soju/utils');
      const interaction = createMockInteraction({ options: { shiny_id: 'abc' } });

      const fakeShiny = {
        national_number: 1,
        pokemon: 'Testmon',
        trainer_name: 'T1',
        catch_date: '2020-01-01'
      };

      axios.get.mockResolvedValueOnce({ data: { data: fakeShiny } });
      axios.put.mockResolvedValueOnce({ data: { data: fakeShiny } });
      getSpriteUrl.mockResolvedValue('http://example.com/sprite.gif');
      greyscale.mockResolvedValue(Buffer.from('grey'));

      await handleFailShiny(interaction);

      expect(getSpriteUrl).toHaveBeenCalledWith(fakeShiny.national_number);
      expect(greyscale).toHaveBeenCalledWith('http://example.com/sprite.gif');
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array) })
      );
    });

    it('should still reply even if greyscale fails', async () => {
      const { greyscale, getSpriteUrl } = require('@team-soju/utils');
      const interaction = createMockInteraction({ options: { shiny_id: 'def' } });

      const fakeShiny = { national_number: 2, pokemon: 'Foo', trainer_name: 'T1', catch_date: '2020-01-01' };
      axios.get.mockResolvedValueOnce({ data: { data: fakeShiny } });
      axios.put.mockResolvedValueOnce({ data: { data: fakeShiny } });
      getSpriteUrl.mockResolvedValue('http://example.com/sprite.png');
      greyscale.mockRejectedValue(new Error('oops'));

      await handleFailShiny(interaction);

      // greyscale error should be caught but call still proceeds
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array) })
      );
    });
  });
});
