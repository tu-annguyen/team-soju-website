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
  getKnownPokemonNames: jest.fn(() => [
    'charizard',
    'charmander',
    'charmeleon',
    'chimchar',
    'nidoran-f',
    'nidoran-m',
  ]),
  getNationalNumber: jest.fn().mockResolvedValue(1),
  getPokemonEvolutionLine: jest.fn().mockResolvedValue(['charmander', 'charmeleon', 'charizard']),
  getSpriteUrl: jest.fn().mockResolvedValue('https://example.com/sprite.gif'),
  getPokemonVariants: jest.fn(),
}));

const fetchClient = require('../src/fetchClient');
const { getPokemonEvolutionLine, getPokemonVariants, getSpriteUrl } = require('@team-soju/utils');
const localUtils = require('../src/utils');
const {
  enhanceAsyncScreenshotPayload,
  handleAddShiny,
  handleAddShinyScreenshot,
  handleEditShiny,
  handleFailShiny,
  handleGetShiny,
  handleGetShinies,
  handleGetMyShinies,
  handlePokemonAutocomplete,
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
    getSpriteUrl.mockResolvedValue('https://example.com/sprite.gif');
    getPokemonEvolutionLine.mockResolvedValue(['charmander', 'charmeleon', 'charizard']);
    getPokemonVariants.mockResolvedValue({
      variants: ['dratini'],
      entries: [{ value: 'dratini', label: 'dratini', is_default: true }],
    });
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

  it('returns pokemon autocomplete suggestions from the known list', async () => {
    const interaction = createMockInteraction({
      isChatInputCommand: jest.fn().mockReturnValue(false),
      isAutocomplete: jest.fn().mockReturnValue(true),
      respondAutocomplete: jest.fn().mockResolvedValue(undefined),
    });

    interaction.options.getFocused = jest.fn().mockReturnValue('char');
    interaction.options.getFocusedOption = jest.fn().mockReturnValue({
      name: 'pokemon',
      value: 'char',
      focused: true,
    });

    await handlePokemonAutocomplete(interaction);

    expect(interaction.respondAutocomplete).toHaveBeenCalledWith([
      { name: 'Charizard', value: 'charizard' },
      { name: 'Charmander', value: 'charmander' },
      { name: 'Charmeleon', value: 'charmeleon' },
      { name: 'Chimchar', value: 'chimchar' },
    ]);
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

  it('clamps oversized shiny list limits to 25 select options', async () => {
    const interaction = createMockInteraction({
      options: { trainer: 'tester', limit: 30 },
    });

    const shinyRows = Array.from({ length: 30 }, (_, index) => ({
      id: String(index + 1),
      pokemon_name: `Pokemon ${index + 1}`,
      trainer_name: 'Tester',
      catch_date: `2026-01-${String(30 - index).padStart(2, '0')}`,
      total_encounters: index + 1,
    }));

    fetchClient.get
      .mockResolvedValueOnce({ data: { data: { id: 'trainer-id' } } })
      .mockResolvedValueOnce({ data: { data: { id: 'trainer-id', ign: 'tester' } } })
      .mockResolvedValueOnce({ data: { data: shinyRows } });

    await handleGetShinies(interaction);

    const payload = interaction.editReply.mock.calls[0][0];

    expect(payload.components[1].components[0].options).toHaveLength(25);
    expect(payload.embeds[0].data.footer.text).toBe('Page 1 of 2');
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
          pokemon: 'deerling',
          pokemon_name: 'Deerling',
          variants: 'deerling-winter',
          trainer_name: 'T1',
          encounter_type: 'x5_horde',
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
    getPokemonVariants.mockResolvedValue({
      variants: ['deerling-spring', 'deerling-summer', 'deerling-autumn', 'deerling-winter'],
      entries: [
        { value: 'deerling-spring', label: 'spring', is_default: true },
        { value: 'deerling-summer', label: 'summer', is_default: false },
        { value: 'deerling-autumn', label: 'autumn', is_default: false },
        { value: 'deerling-winter', label: 'winter', is_default: false },
      ],
    });

    await handleShinyComponent(interaction);

    expect(interaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Choose a field to edit.',
        embeds: expect.any(Array),
        components: expect.arrayContaining([
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({ custom_id: 'sh:fp:pokemon:open:selected-id' }),
              expect.objectContaining({ custom_id: 'sh:vp:open:selected-id' }),
            ]),
          }),
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({ custom_id: 'sh:fp:encounter_type:open:selected-id' }),
              expect.objectContaining({ custom_id: 'sh:fp:status:open:selected-id' }),
              expect.objectContaining({ custom_id: 'sh:fp:nature:open:selected-id' }),
            ]),
          }),
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({ custom_id: 'sh:tm:catch_date:selected-id' }),
              expect.objectContaining({ custom_id: 'sh:tm:encounters:selected-id' }),
              expect.objectContaining({ custom_id: 'sh:tm:ivs:selected-id' }),
            ]),
          }),
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({ custom_id: 'sh:fp:special:open:selected-id' }),
              expect.objectContaining({ custom_id: 'sh:d:b:a:_:1:10:selected-id' }),
            ]),
          }),
        ]),
      })
    );
  });

  it('disables the variant button when the pokemon has no variants', async () => {
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
          variants: 'pikachu',
          trainer_name: 'T1',
          encounter_type: 'x5_horde',
          nature: 'Bold',
        },
      },
    });
    getPokemonVariants.mockResolvedValue({
      variants: ['pikachu'],
      entries: [{ value: 'pikachu', label: 'pikachu', is_default: true }],
    });

    await handleShinyComponent(interaction);

    const payload = interaction.update.mock.calls[0][0];
    const variantButton = payload.components[0].components.find(component => component.custom_id === 'sh:vp:open:selected-id');
    expect(variantButton.disabled).toBe(true);
  });

  it('opens the catch date advanced modal from the edit controls', async () => {
    const interaction = createMockInteraction({
      customId: 'sh:tm:catch_date:selected-id',
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
          encounter_type: 'x5_horde',
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
    expect(modal.title).toBe('Advanced Text Fields');
    expect(modal.components).toHaveLength(1);
    expect(modal.components[0].components[0].custom_id).toBe('catch_date');
  });

  it('opens the encounter type picker from the edit controls', async () => {
    const interaction = createMockInteraction({
      customId: 'sh:fp:encounter_type:open:selected-id',
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
          encounter_type: 'single',
          nature: 'Bold',
          is_secret: false,
          is_alpha: false,
        },
      },
    });

    await handleShinyComponent(interaction);

    expect(interaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        components: expect.arrayContaining([
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({ custom_id: 'sh:fp:encounter_type:pick:selected-id' }),
            ]),
          }),
        ]),
      })
    );
  });

  it('updates a shiny from edit picker selection', async () => {
    const interaction = createMockInteraction({
      customId: 'sh:fp:encounter_type:pick:selected-id',
      member: { roles: { cache: [{ name: 'Champion' }] } },
      values: ['x5_horde'],
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
            encounter_type: 'x5_horde',
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
          encounter_type: 'x5_horde',
          nature: 'Bold',
          is_secret: false,
          is_alpha: false,
        },
      },
    });

    await handleShinyComponent(interaction);

    expect(fetchClient.put).toHaveBeenCalledWith(
      expect.stringContaining('/shinies/selected-id'),
      expect.objectContaining({ encounter_type: 'x5_horde' }),
      expect.any(Object)
    );
    expect(interaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Shiny updated.',
        components: expect.any(Array),
      })
    );
  });

  it('opens the pokemon picker from the edit controls', async () => {
    const interaction = createMockInteraction({
      customId: 'sh:fp:pokemon:open:selected-id',
      member: { roles: { cache: [{ name: 'Champion' }] } },
      update: jest.fn().mockResolvedValue(undefined),
    });
    getPokemonEvolutionLine.mockResolvedValue(['chimchar', 'monferno', 'infernape']);

    fetchClient.get.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          pokemon: 'chimchar',
          pokemon_name: 'Chimchar',
          trainer_name: 'T1',
          national_number: 390,
        },
      },
    });

    await handleShinyComponent(interaction);

    const payload = interaction.update.mock.calls[0][0];
    expect(payload.content).toBe('Choose a Pokemon from the Chimchar evolution line.');
    expect(payload.components[0].components[0].custom_id).toBe('sh:pk:pick:selected-id');
    expect(payload.components[0].components[0].options).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'chimchar', default: true }),
      expect.objectContaining({ value: 'infernape', default: false }),
    ]));
  });

  it('updates a shiny from pokemon picker selection', async () => {
    const interaction = createMockInteraction({
      customId: 'sh:pk:pick:selected-id',
      member: { roles: { cache: [{ name: 'Champion' }] } },
      values: ['charizard'],
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
            national_number: 25,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'selected-id',
            pokemon: 'charizard',
            pokemon_name: 'Charizard',
            trainer_name: 'T1',
            national_number: 6,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'selected-id',
            pokemon: 'charizard',
            pokemon_name: 'Charizard',
            trainer_name: 'T1',
            national_number: 6,
          },
        },
      });
    fetchClient.put.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          pokemon: 'charizard',
          pokemon_name: 'Charizard',
          trainer_name: 'T1',
          national_number: 6,
        },
      },
    });

    await handleShinyComponent(interaction);

    expect(fetchClient.put).toHaveBeenCalledWith(
      expect.stringContaining('/shinies/selected-id'),
      expect.objectContaining({ pokemon: 'charizard', national_number: 1 }),
      expect.any(Object)
    );
    expect(interaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Pokemon updated.',
      })
    );
  });

  it('updates a shiny from advanced text modal submission', async () => {
    const interaction = createMockInteraction({
      customId: 'shm:advanced:encounters:selected-id',
      reply: jest.fn().mockResolvedValue(undefined),
      fields: {
        getTextInputValue: jest.fn((name) => ({
          encounters: '10,5',
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
          encounter_type: 'x5_horde',
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
          encounter_type: 'x5_horde',
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
        total_encounters: 10,
        species_encounters: 5,
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

  it('updates the shiny variant from the post-add dropdown', async () => {
    const interaction = createMockInteraction({
      customId: 'sh:r:v:a:_:1:10:selected-id',
      values: ['deerling-winter'],
      member: { roles: { cache: [{ name: 'Champion' }] } },
      update: jest.fn().mockResolvedValue(undefined),
    });

    getPokemonVariants.mockResolvedValue({
      variants: ['deerling-spring', 'deerling-summer', 'deerling-autumn', 'deerling-winter'],
      entries: [
        { value: 'deerling-spring', label: 'spring', is_default: true },
        { value: 'deerling-summer', label: 'summer', is_default: false },
        { value: 'deerling-autumn', label: 'autumn', is_default: false },
        { value: 'deerling-winter', label: 'winter', is_default: false },
      ],
    });
    getSpriteUrl.mockImplementation(async (pokemonId, options = {}) => `https://example.com/${options.variant || pokemonId}.gif`);

    fetchClient.get
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'selected-id',
            pokemon: 'deerling',
            variants: 'deerling-spring',
            trainer_name: 'T1',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'selected-id',
            pokemon: 'deerling',
            pokemon_name: 'Deerling',
            variants: 'deerling-winter',
            national_number: 585,
            trainer_name: 'T1',
            status: 'Owned',
            encounter_type: 'x5_horde',
          },
        },
      });
    fetchClient.put.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          variants: 'deerling-winter',
        },
      },
    });

    await handleShinyComponent(interaction);

    expect(fetchClient.put).toHaveBeenCalledWith(
      expect.stringContaining('/shinies/selected-id'),
      { variants: 'deerling-winter' },
      expect.any(Object)
    );
    expect(interaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Shiny updated.',
        embeds: [
          expect.objectContaining({
            data: expect.objectContaining({
              thumbnail: { url: 'https://example.com/deerling-winter.gif' },
            }),
          }),
        ],
        components: expect.arrayContaining([
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({
                custom_id: 'sh:r:v:a:_:1:10:selected-id',
                options: expect.arrayContaining([
                  expect.objectContaining({ value: 'deerling-winter', default: true }),
                  expect.objectContaining({ value: 'deerling-spring', default: false }),
                ]),
              }),
            ]),
          }),
        ]),
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
        encounter_type: '5x Horde',
        catch_date: '2026-01-15',
        status: 'Bred',
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
          encounter_type: 'x5_horde',
          status: 'Bred',
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

    expect(fetchClient.post).toHaveBeenCalledWith(
      expect.stringContaining('/shinies'),
      expect.objectContaining({ status: 'Bred' }),
      expect.any(Object)
    );

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        components: [
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({ custom_id: 'sh:a:v:a:_:1:10:created-shiny-id' }),
              expect.objectContaining({ custom_id: 'sh:a:e:a:_:1:10:created-shiny-id' }),
              expect.objectContaining({ custom_id: 'sh:a:d:a:_:1:10:created-shiny-id' }),
            ]),
          }),
        ],
      })
    );
  });

  it('adds a variant selector after addshiny and defaults to the is_default form', async () => {
    const interaction = createMockInteraction({
      commandName: 'addshiny',
      member: { roles: { cache: [{ name: 'Champion' }] } },
      options: {
        trainer: 'testtrainer',
        pokemon: 'deerling',
        encounter_type: '5x Horde',
      },
    });

    getPokemonVariants.mockResolvedValue({
      variants: ['deerling-spring', 'deerling-summer', 'deerling-autumn', 'deerling-winter'],
      entries: [
        { value: 'deerling-spring', label: 'spring', is_default: true },
        { value: 'deerling-summer', label: 'summer', is_default: false },
        { value: 'deerling-autumn', label: 'autumn', is_default: false },
        { value: 'deerling-winter', label: 'winter', is_default: false },
      ],
    });

    fetchClient.get.mockResolvedValue({
      data: { data: { id: 'trainer-id', ign: 'testtrainer' } },
    });
    fetchClient.post.mockResolvedValue({
      data: {
        data: {
          id: 'created-shiny-id',
          pokemon: 'deerling',
          variants: 'deerling',
          national_number: 585,
          trainer_name: 'testtrainer',
          catch_date: '2026-01-15',
          encounter_type: 'x5_horde',
        },
      },
    });
    fetchClient.put.mockResolvedValue({
      data: {
        data: {
          id: 'created-shiny-id',
          pokemon: 'deerling',
          variants: 'deerling-spring',
          national_number: 585,
          trainer_name: 'testtrainer',
          catch_date: '2026-01-15',
          encounter_type: 'x5_horde',
        },
      },
    });

    await handleAddShiny(interaction);

    expect(fetchClient.put).toHaveBeenCalledWith(
      expect.stringContaining('/shinies/created-shiny-id'),
      { variants: 'deerling-spring' },
      expect.any(Object)
    );

    const payload = interaction.editReply.mock.calls[0][0];
    expect(payload.components[0].components[0].custom_id).toBe('sh:r:v:a:_:1:10:created-shiny-id');
    expect(payload.components[0].components[0].options).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'deerling-spring', default: true }),
      expect.objectContaining({ value: 'deerling-winter', default: false }),
    ]));
  });

  it('queues addshinyscreenshot work and replies with a processing message', async () => {
    const interaction = createMockInteraction({
      commandName: 'addshinyscreenshot',
      member: { roles: { cache: [{ name: 'Champion' }] } },
      options: {
        screenshot: {
          url: 'https://example.com/image.png',
          proxyURL: 'https://media.discordapp.net/attachments/image.png',
        },
        encounter_type: '5x Horde',
        secret: false,
        alpha: false,
      },
    });

    fetchClient.post.mockResolvedValue({
      data: {
        data: {
          job_id: 'ss-123',
          status: 'queued',
        },
      },
    });

    await handleAddShinyScreenshot(interaction);

    expect(fetchClient.post).toHaveBeenCalledWith(
      expect.stringContaining('/shinies/from-screenshot/async'),
      expect.objectContaining({
        screenshot_url: 'https://media.discordapp.net/attachments/image.png',
        command_called_at: expect.any(String),
        discord_application_id: 'app-123',
        discord_interaction_token: 'interaction-token',
        callback_url: 'https://example.com/internal/screenshot-result',
      }),
      expect.any(Object)
    );
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('ss-123'),
      })
    );
  });

  it('adds a variant selector to async screenshot success payloads', async () => {
    getPokemonVariants.mockResolvedValue({
      variants: ['basculin-red-striped', 'basculin-blue-striped'],
      entries: [
        { value: 'basculin-red-striped', label: 'red-striped', is_default: true },
        { value: 'basculin-blue-striped', label: 'blue-striped', is_default: false },
      ],
    });

    fetchClient.get.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          pokemon: 'basculin',
          variants: 'basculin',
          national_number: 550,
          trainer_name: 'T1',
        },
      },
    });
    fetchClient.put.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          pokemon: 'basculin',
          variants: 'basculin-red-striped',
          national_number: 550,
          trainer_name: 'T1',
        },
      },
    });

    const payload = await enhanceAsyncScreenshotPayload({
      embeds: [{ footer: { text: 'Shiny ID: selected-id' } }],
      components: [
        {
          components: [
            { custom_id: 'sh:a:v:a:_:1:10:selected-id' },
          ],
        },
      ],
    });

    expect(fetchClient.put).toHaveBeenCalledWith(
      expect.stringContaining('/shinies/selected-id'),
      { variants: 'basculin-red-striped' },
      expect.any(Object)
    );
    expect(payload.components[0].components[0].custom_id).toBe('sh:r:v:a:_:1:10:selected-id');
  });

  it('tells the user the original message will be updated after screenshot OCR finishes', async () => {
    const interaction = createMockInteraction({
      commandName: 'addshinyscreenshot',
      member: { roles: { cache: [{ name: 'Champion' }] } },
      options: {
        screenshot: { url: 'https://example.com/sneasel-mobile.png' },
        encounter_type: '5x Horde',
        secret: false,
        alpha: false,
      },
    });

    fetchClient.post.mockResolvedValue({
      data: {
        data: {
          job_id: 'ss-456',
          status: 'queued',
        },
      },
    });

    await handleAddShinyScreenshot(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('will update when OCR finishes'),
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
              expect.objectContaining({ custom_id: 'sh:a:d:a:_:1:10:selected-id' }),
            ]),
          }),
        ],
      })
    );
  });

  it('uses the shiny variant when fetching the normal sprite', async () => {
    const interaction = createMockInteraction({
      commandName: 'shiny',
      member: { roles: { cache: [{ name: 'Champion' }] } },
      options: { id: 'selected-id' },
    });

    fetchClient.get.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          pokemon: 'wormadam',
          pokemon_name: 'Wormadam',
          variants: 'wormadam-sandy',
          trainer_name: 'T1',
          national_number: 413,
        },
      },
    });

    await handleGetShiny(interaction);

    expect(getPokemonVariants).not.toHaveBeenCalledWith('wormadam-sandy');
    const { getSpriteUrl } = require('@team-soju/utils');
    expect(getSpriteUrl).toHaveBeenCalledWith(413, { variant: 'wormadam-sandy' });
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
      options: { shiny_id: 'selected-id', status: 'Died' },
    });

    fetchClient.get.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          pokemon: 'pikachu',
          pokemon_name: 'Pikachu',
          variants: 'pikachu',
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
          variants: 'pikachu',
          national_number: 25,
          trainer_name: 'T1',
          catch_date: '2026-01-01',
          encounter_type: 'horde',
          status: 'Died',
        },
      },
    });

    await handleFailShiny(interaction);

    const payload = interaction.editReply.mock.calls[0][0];
    expect(fetchClient.put).toHaveBeenCalledWith(
      expect.stringContaining('/shinies/selected-id'),
      expect.objectContaining({ status: 'Died' }),
      expect.any(Object)
    );
    expect(payload.embeds[0].data.title).toBe('Shiny Status Updated');
    expect(payload.embeds[0].data.color).toBe(0x757575);
    expect(payload.embeds[0].data.thumbnail.url).toContain('/shinies/sprites/25/greyscale');
  });

  it('updates the shiny variant from the editshiny slash command', async () => {
    const interaction = createMockInteraction({
      commandName: 'editshiny',
      member: { roles: { cache: [{ name: 'Champion' }] } },
      options: { shiny_id: 'selected-id', variant: ' Deerling-Winter ' },
    });

    fetchClient.get.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          pokemon: 'deerling',
          pokemon_name: 'Deerling',
          variants: 'deerling-spring',
          national_number: 585,
          trainer_name: 'T1',
          catch_date: '2026-01-01',
          encounter_type: 'single',
        },
      },
    });
    fetchClient.put.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          pokemon: 'deerling',
          pokemon_name: 'Deerling',
          variants: 'deerling-winter',
          national_number: 585,
          trainer_name: 'T1',
          catch_date: '2026-01-01',
          encounter_type: 'single',
        },
      },
    });

    await handleEditShiny(interaction);

    expect(fetchClient.put).toHaveBeenCalledWith(
      expect.stringContaining('/shinies/selected-id'),
      expect.objectContaining({ variants: 'deerling-winter' }),
      expect.any(Object)
    );
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [expect.objectContaining({ data: expect.objectContaining({ title: 'Shiny Updated Successfully' }) })],
      })
    );
  });

  it('collapses nidoran route slugs when updating a shiny variant from the slash command', async () => {
    const interaction = createMockInteraction({
      commandName: 'editshiny',
      member: { roles: { cache: [{ name: 'Champion' }] } },
      options: { shiny_id: 'selected-id', variant: ' Nidoran-F ' },
    });

    fetchClient.get.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          pokemon: 'nidoran',
          pokemon_name: 'Nidoran',
          variants: 'nidoran',
          national_number: 29,
          trainer_name: 'T1',
          catch_date: '2026-01-01',
          encounter_type: 'single',
        },
      },
    });
    fetchClient.put.mockResolvedValue({
      data: {
        data: {
          id: 'selected-id',
          pokemon: 'nidoran',
          pokemon_name: 'Nidoran',
          variants: 'nidoran',
          national_number: 29,
          trainer_name: 'T1',
          catch_date: '2026-01-01',
          encounter_type: 'single',
        },
      },
    });

    await handleEditShiny(interaction);

    expect(fetchClient.put).toHaveBeenCalledWith(
      expect.stringContaining('/shinies/selected-id'),
      expect.objectContaining({ variants: 'nidoran' }),
      expect.any(Object)
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
          variants: 'pikachu',
          trainer_name: 'T1',
          national_number: 25,
          status: 'Sold',
        },
      },
    });

    await handleGetShiny(interaction);

    const payload = interaction.editReply.mock.calls[0][0];
    expect(payload.embeds[0].data.color).toBe(0x757575);
    expect(payload.embeds[0].data.thumbnail.url).toContain('/shinies/sprites/25/greyscale');
    expect(payload.embeds[0].data.thumbnail.url).toContain('variant=pikachu');
  });

  it('updates status to a non-owned value from edit controls and re-renders with greyscaled thumbnail', async () => {
    const interaction = createMockInteraction({
      customId: 'sh:e:f:a:_:1:10:selected-id',
      values: ['Died'],
      member: { roles: { cache: [{ name: 'Champion' }] } },
      update: jest.fn().mockResolvedValue(undefined),
    });

    fetchClient.get
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'selected-id',
            trainer_name: 'T1',
            trainer_id: 'trainer-1',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'selected-id',
            pokemon: 'pikachu',
            pokemon_name: 'Pikachu',
            national_number: 25,
            trainer_name: 'T1',
            status: 'Died',
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
          status: 'Died',
        },
      },
    });

    await handleShinyComponent(interaction);

    expect(fetchClient.put).toHaveBeenCalledWith(
      expect.stringContaining('/shinies/selected-id'),
      expect.objectContaining({ status: 'Died' }),
      expect.any(Object)
    );
    const payload = interaction.update.mock.calls[0][0];
    expect(payload.content).toBe('Shiny updated.');
    expect(payload.embeds[0].data.color).toBe(0x757575);
    expect(payload.embeds[0].data.thumbnail.url).toContain('/shinies/sprites/25/greyscale');
  });

  it('updates status to Owned from edit controls and restores the normal thumbnail', async () => {
    const interaction = createMockInteraction({
      customId: 'sh:e:f:a:_:1:10:selected-id',
      values: ['Owned'],
      member: { roles: { cache: [{ name: 'Champion' }] } },
      update: jest.fn().mockResolvedValue(undefined),
    });

    fetchClient.get
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'selected-id',
            trainer_name: 'T1',
            trainer_id: 'trainer-1',
            status: 'Fled',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'selected-id',
            pokemon: 'pikachu',
            pokemon_name: 'Pikachu',
            national_number: 25,
            trainer_name: 'T1',
            status: 'Owned',
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
          status: 'Owned',
        },
      },
    });

    await handleShinyComponent(interaction);

    expect(fetchClient.put).toHaveBeenCalledWith(
      expect.stringContaining('/shinies/selected-id'),
      expect.objectContaining({ status: 'Owned' }),
      expect.any(Object)
    );
    expect(interaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({
            data: expect.objectContaining({
              thumbnail: { url: 'https://example.com/sprite.gif' },
              color: 0x4CAF50,
            }),
          }),
        ],
        content: 'Shiny updated.',
      })
    );
  });
});
