/**
 * Mock Discord Interaction factory for testing
 */

/**
 * Creates a mock Discord interaction object
 * @param {Object} overrides - Override specific interaction properties
 * @returns {Object} Mock interaction object
 */
function createMockInteraction(overrides = {}) {
  const defaultOptions = {
    ign: 'testplayer',
    new_ign: null,
    pokemon: 'dratini',
    trainer: 'testtrainer',
    pokedex_number: '147',
    encounter_type: 'Horde',
    catch_date: '2026-01-15',
    secret: false,
    total_encounters: 1000,
    species_encounters: 100,
    nature: 'Bold',
    ivs: '31,31,31,31,31,31',
    shiny_id: 'test-shiny-id',
    id: 'test-shiny-id',
    limit: 10,
    rank: 'Trainer',
    discord: null
  };

  const optionValues = { ...defaultOptions, ...(overrides.options || {}) };

  const interaction = {
    commandName: overrides.commandName || 'test',
    user: {
      id: overrides.user?.id || '123456789',
      tag: overrides.user?.tag || 'TestUser#0001'
    },
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    isChatInputCommand: jest.fn().mockReturnValue(true),
    deferred: false,
    replied: false,
    options: {
      getString: jest.fn((name) => optionValues[name] ?? null),
      getUser: jest.fn((name) => optionValues[name] ?? null),
      getInteger: jest.fn((name) => optionValues[name] ?? null),
      getBoolean: jest.fn((name) => optionValues[name] ?? null)
    }
  };

  // Merge non-options properties
  const { options, ...otherOverrides } = overrides;
  Object.assign(interaction, otherOverrides);

  return interaction;
}

/**
 * Creates a mock Discord user object
 * @param {Object} overrides - Override specific user properties
 * @returns {Object} Mock user object
 */
function createMockUser(overrides = {}) {
  return {
    id: overrides.id || '987654321',
    username: overrides.username || 'MockUser',
    tag: overrides.tag || 'MockUser#1234',
    ...overrides
  };
}

module.exports = {
  createMockInteraction,
  createMockUser
};
