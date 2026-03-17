jest.mock('../src/fetchClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

jest.mock('@team-soju/utils', () => ({
  capitalize: jest.fn((value) => {
    const normalized = String(value || '').trim();
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase() : normalized;
  }),
  getPokemonNationalNumber: jest.fn().mockResolvedValue(1),
  getSpriteUrl: jest.fn().mockResolvedValue('https://example.com/sprite.gif'),
}));

const fetchClient = require('../src/fetchClient');
const localUtils = require('../src/utils');
const {
  handleGetShinies,
  handleGetMyShinies,
  handleShinyComponent,
  handleShinyEditModal,
} = require('../src/handlers/shinyHandlers');
const { MessageFlags } = require('../src/discord/api');
const { createMockInteraction } = require('./fixtures/mockInteraction');

const validateSojuTrainerIGNSpy = jest.spyOn(localUtils, 'validateSojuTrainerIGN').mockResolvedValue({ valid: true });

describe('shinyHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validateSojuTrainerIGNSpy.mockResolvedValue({ valid: true });
  });

  it('renders shinies with stateless components', async () => {
    const interaction = createMockInteraction({
      options: { trainer: 'tester', limit: 2 },
    });

    fetchClient.get
      .mockResolvedValueOnce({ data: { data: { id: 'trainer-id' } } })
      .mockResolvedValueOnce({ data: { data: { id: 'trainer-id', ign: 'tester' } } })
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

  it('renders linked member shinies for myshinies as ephemeral', async () => {
    const interaction = createMockInteraction({
      user: { id: 'discord-user' },
      options: { limit: 5 },
    });

    fetchClient.get
      .mockResolvedValueOnce({ data: { data: { id: 'trainer-id', ign: 'Tester' } } })
      .mockResolvedValueOnce({
        data: {
          data: [{ id: '1', pokemon_name: 'A', trainer_name: 'Tester', catch_date: '2026-01-03', total_encounters: 1 }],
        },
      });

    await handleGetMyShinies(interaction);

    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        components: expect.any(Array),
      })
    );
  });

  it('updates the list when a shiny is selected', async () => {
    const interaction = createMockInteraction({
      customId: 'sh:s:pick:a:_:1:10:_',
      values: ['selected-id'],
      update: jest.fn().mockResolvedValue(undefined),
    });

    fetchClient.get.mockResolvedValue({
      data: {
        data: [
          { id: 'selected-id', pokemon_name: 'A', trainer_name: 'T1', catch_date: '2026-01-03', total_encounters: 1 },
        ],
      },
    });

    await handleShinyComponent(interaction);

    expect(interaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        components: expect.any(Array),
      })
    );
  });

  it('shows the edit modal for authorized users', async () => {
    const interaction = createMockInteraction({
      customId: 'sh:a:e:a:_:1:10:selected-id',
      member: { roles: { cache: [{ name: 'Champion' }] } },
      showModal: jest.fn().mockResolvedValue(undefined),
    });

    fetchClient.get.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          pokemon: 'pikachu',
          pokemon_name: 'Pikachu',
          trainer_name: 'T1',
          encounter_type: 'horde',
          total_encounters: 1,
          species_encounters: 1,
        },
      },
    });

    await handleShinyComponent(interaction);

    expect(interaction.showModal).toHaveBeenCalled();
  });

  it('updates a shiny from modal submission', async () => {
    const interaction = createMockInteraction({
      customId: 'shm:edit:selected-id',
      reply: jest.fn().mockResolvedValue(undefined),
      fields: {
        getTextInputValue: jest.fn((name) => ({
          pokemon: 'pikachu',
          catch_date: '2026-01-01',
          encounter_type: 'horde',
          encounters: '10,5',
          ivs: '1,2,3,4,5,6',
        }[name] || '')),
      },
      member: { roles: { cache: [{ name: 'Champion' }] } },
    });

    fetchClient.get.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          pokemon: 'pikachu',
          pokemon_name: 'Pikachu',
          trainer_name: 'T1',
          encounter_type: 'horde',
        },
      },
    });
    fetchClient.put.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          pokemon: 'pikachu',
          pokemon_name: 'Pikachu',
          trainer_name: 'T1',
          national_number: 25,
          encounter_type: 'horde',
          catch_date: '2026-01-01',
          total_encounters: 10,
          species_encounters: 5,
        },
      },
    });

    await handleShinyEditModal(interaction);

    expect(fetchClient.put).toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        flags: MessageFlags.Ephemeral,
      })
    );
  });
});
