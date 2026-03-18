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
  handleAddShiny,
  handleAddShinyScreenshot,
  handleFailShiny,
  handleGetShiny,
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
    fetchClient.get.mockReset();
    fetchClient.post.mockReset();
    fetchClient.put.mockReset();
    fetchClient.delete.mockReset();
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

  it('shows edit controls for authorized users', async () => {
    const interaction = createMockInteraction({
      customId: 'sh:a:e:a:_:1:10:selected-id',
      member: { roles: { cache: [{ name: 'Champion' }] } },
      update: jest.fn().mockResolvedValue(undefined),
    });

    fetchClient.get.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          pokemon: 'pikachu',
          pokemon_name: 'Pikachu',
          trainer_name: 'T1',
          encounter_type: 'horde',
          total_encounters: 1234,
          species_encounters: 567,
          iv_hp: 1,
          iv_attack: 2,
          iv_defense: 3,
          iv_sp_attack: 4,
          iv_sp_defense: 5,
          iv_speed: 6,
        },
      },
    });

    await handleShinyComponent(interaction);

    expect(interaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        components: expect.arrayContaining([
          expect.objectContaining({
            components: expect.arrayContaining([expect.objectContaining({ custom_id: 'sh:e:t:a:_:1:10:selected-id' })]),
          }),
          expect.objectContaining({
            components: expect.arrayContaining([expect.objectContaining({ custom_id: 'sh:e:n:a:_:1:10:selected-id' })]),
          }),
          expect.objectContaining({
            components: expect.arrayContaining([expect.objectContaining({ custom_id: 'sh:e:s:a:_:1:10:selected-id' })]),
          }),
          expect.objectContaining({
            components: expect.arrayContaining([expect.objectContaining({ custom_id: 'sh:e:a:a:_:1:10:selected-id' })]),
          }),
        ]),
      })
    );
  });

  it('opens the text edit modal from the edit controls', async () => {
    const interaction = createMockInteraction({
      customId: 'sh:m:o:a:_:1:10:selected-id',
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
          total_encounters: 1234,
          species_encounters: 567,
          iv_hp: 1,
          iv_attack: 2,
          iv_defense: 3,
          iv_sp_attack: 4,
          iv_sp_defense: 5,
          iv_speed: 6,
        },
      },
    });

    await handleShinyComponent(interaction);

    expect(interaction.showModal).toHaveBeenCalled();
    const modal = interaction.showModal.mock.calls[0][0].toJSON();
    expect(modal.components).toHaveLength(4);
    expect(modal.components.some(row => row.components.some(component => component.custom_id === 'pokemon'))).toBe(true);
    expect(modal.components.some(row => row.components.some(component => component.custom_id === 'encounters'))).toBe(true);
    expect(modal.components.find(row => row.components[0].custom_id === 'encounters').components[0].value).toBe('1234,567');
    expect(modal.components.find(row => row.components[0].custom_id === 'ivs').components[0].value).toBe('1,2,3,4,5,6');
  });

  it('updates a shiny from edit dropdown selection', async () => {
    const interaction = createMockInteraction({
      customId: 'sh:e:t:a:_:1:10:selected-id',
      member: { roles: { cache: [{ name: 'Champion' }] } },
      values: ['horde'],
      update: jest.fn().mockResolvedValue(undefined),
    });

    fetchClient.get
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'selected-id',
            pokemon: 'pikachu',
            pokemon_name: 'Pikachu',
            trainer_name: 'T1',
            encounter_type: 'single',
            nature: 'Bold',
            is_secret: false,
            is_alpha: false,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'selected-id',
            pokemon: 'pikachu',
            pokemon_name: 'Pikachu',
            trainer_name: 'T1',
            encounter_type: 'horde',
            nature: 'Bold',
            is_secret: false,
            is_alpha: false,
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
          encounter_type: 'horde',
          nature: 'Bold',
          is_secret: false,
          is_alpha: false,
        },
      },
    });

    await handleShinyComponent(interaction);

    expect(fetchClient.put).toHaveBeenCalledWith(
      expect.stringContaining('/shinies/selected-id'),
      expect.objectContaining({ encounter_type: 'horde' }),
      expect.any(Object)
    );
    expect(interaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Shiny updated.',
        components: expect.any(Array),
      })
    );
  });

  it('updates a shiny from modal submission', async () => {
    const interaction = createMockInteraction({
      customId: 'shm:edit:selected-id',
      reply: jest.fn().mockResolvedValue(undefined),
      fields: {
        getTextInputValue: jest.fn((name) => ({
          pokemon: 'pikachu',
          catch_date: '2026-01-01',
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

    expect(fetchClient.put).toHaveBeenCalledWith(
      expect.stringContaining('/shinies/selected-id'),
      expect.objectContaining({
        catch_date: '2026-01-01',
        total_encounters: 10,
        species_encounters: 5,
        iv_hp: 1,
        iv_speed: 6,
      }),
      expect.any(Object)
    );
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        flags: MessageFlags.Ephemeral,
      })
    );
  });

  it('adds action buttons to the addshiny confirmation', async () => {
    const interaction = createMockInteraction({
      commandName: 'addshiny',
      member: { roles: { cache: [{ name: 'Champion' }] } },
      options: {
        trainer: 'testtrainer',
        pokemon: 'dratini',
        encounter_type: 'Horde',
        catch_date: '2026-01-15',
        secret: false,
        alpha: false,
        total_encounters: 1000,
        species_encounters: 100,
        nature: 'Bold',
        ivs: '31,31,31,31,31,31',
      },
    });

    fetchClient.get.mockResolvedValue({
      data: { data: { id: 'trainer-id', ign: 'testtrainer' } },
    });
    fetchClient.post.mockResolvedValue({
      data: {
        data: {
          id: 'created-shiny-id',
          pokemon: 'dratini',
          national_number: 147,
          trainer_name: 'testtrainer',
          catch_date: '2026-01-15',
          encounter_type: 'horde',
          total_encounters: 1000,
          species_encounters: 100,
          nature: 'Bold',
          iv_hp: 31,
          iv_attack: 31,
          iv_defense: 31,
          iv_sp_attack: 31,
          iv_sp_defense: 31,
          iv_speed: 31,
        },
      },
    });

    await handleAddShiny(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        components: [
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({ custom_id: 'sh:a:v:a:_:1:10:created-shiny-id' }),
              expect.objectContaining({ custom_id: 'sh:a:e:a:_:1:10:created-shiny-id' }),
              expect.objectContaining({ custom_id: 'sh:a:f:a:_:1:10:created-shiny-id' }),
              expect.objectContaining({ custom_id: 'sh:a:d:a:_:1:10:created-shiny-id' }),
            ]),
          }),
        ],
      })
    );
  });

  it('adds action buttons to the addshinyscreenshot confirmation', async () => {
    const interaction = createMockInteraction({
      commandName: 'addshinyscreenshot',
      member: { roles: { cache: [{ name: 'Champion' }] } },
      options: {
        screenshot: { url: 'https://example.com/image.png' },
        encounter_type: 'Horde',
        date_is_mdy: false,
        secret: false,
        alpha: false,
      },
    });

    fetchClient.post.mockResolvedValue({
      data: {
        data: {
          id: 'screenshot-shiny-id',
          pokemon: 'dratini',
          national_number: 147,
          trainer_name: 'testtrainer',
          encounter_type: 'horde',
          total_encounters: 1000,
          screenshot_url: 'https://example.com/image.png',
          is_secret: false,
        },
      },
    });

    await handleAddShinyScreenshot(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        components: [
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({ custom_id: 'sh:a:v:a:_:1:10:screenshot-shiny-id' }),
              expect.objectContaining({ custom_id: 'sh:a:e:a:_:1:10:screenshot-shiny-id' }),
              expect.objectContaining({ custom_id: 'sh:a:f:a:_:1:10:screenshot-shiny-id' }),
              expect.objectContaining({ custom_id: 'sh:a:d:a:_:1:10:screenshot-shiny-id' }),
            ]),
          }),
        ],
      })
    );
  });

  it('adds mutation buttons to the shiny command response for managers', async () => {
    const interaction = createMockInteraction({
      commandName: 'shiny',
      member: { roles: { cache: [{ name: 'Champion' }] } },
      options: { id: 'selected-id' },
    });

    fetchClient.get.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          pokemon: 'pikachu',
          pokemon_name: 'Pikachu',
          trainer_name: 'T1',
          national_number: 25,
        },
      },
    });

    await handleGetShiny(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        components: [
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({ custom_id: 'sh:a:e:a:_:1:10:selected-id' }),
              expect.objectContaining({ custom_id: 'sh:a:f:a:_:1:10:selected-id' }),
              expect.objectContaining({ custom_id: 'sh:a:d:a:_:1:10:selected-id' }),
            ]),
          }),
        ],
      })
    );
  });

  it('shows the delete success embed for delete interaction', async () => {
    const interaction = createMockInteraction({
      customId: 'sh:a:d:a:_:1:10:selected-id',
      member: { roles: { cache: [{ name: 'Champion' }] } },
      update: jest.fn().mockResolvedValue(undefined),
    });

    fetchClient.get.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          pokemon: 'pikachu',
          pokemon_name: 'Pikachu',
          national_number: 25,
          trainer_name: 'T1',
        },
      },
    });
    fetchClient.delete.mockResolvedValue({ data: { data: {} } });

    await handleShinyComponent(interaction);

    expect(interaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [expect.objectContaining({ data: expect.objectContaining({ title: 'Shiny Deleted Successfully' }) })],
        components: [],
      })
    );
  });

  it('shows a failed confirmation embed with greyscaled sprite', async () => {
    const interaction = createMockInteraction({
      commandName: 'failshiny',
      member: { roles: { cache: [{ name: 'Champion' }] } },
      options: { shiny_id: 'selected-id' },
    });

    fetchClient.get.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          pokemon: 'pikachu',
          pokemon_name: 'Pikachu',
          national_number: 25,
          trainer_name: 'T1',
          catch_date: '2026-01-01',
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
          national_number: 25,
          trainer_name: 'T1',
          catch_date: '2026-01-01',
          encounter_type: 'horde',
          notes: 'Failed',
        },
      },
    });

    await handleFailShiny(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({
            data: expect.objectContaining({
              title: 'Shiny Marked as Failed',
              color: 0x757575,
              thumbnail: { url: 'http://localhost:3001/api/shinies/sprites/25/greyscale' },
            }),
          }),
        ],
      })
    );
  });

  it('uses a greyscaled sprite when viewing a failed shiny', async () => {
    const interaction = createMockInteraction({
      commandName: 'shiny',
      member: { roles: { cache: [{ name: 'Champion' }] } },
      options: { id: 'selected-id' },
    });

    fetchClient.get.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          pokemon: 'pikachu',
          pokemon_name: 'Pikachu',
          trainer_name: 'T1',
          national_number: 25,
          notes: 'Failed',
        },
      },
    });

    await handleGetShiny(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({
            data: expect.objectContaining({
              thumbnail: { url: 'http://localhost:3001/api/shinies/sprites/25/greyscale' },
              color: 0x757575,
            }),
          }),
        ],
      })
    );
  });
});
