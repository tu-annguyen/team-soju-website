const {
  handleAddMember,
  handleGetMember,
} = require('../src/handlers/memberHandlers');
const { createMockInteraction, createMockUser } = require('./fixtures/mockInteraction');

jest.mock('../src/fetchClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

const fetchClient = require('../src/fetchClient');

describe('memberHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds a member successfully', async () => {
    const interaction = createMockInteraction({
      options: {
        ign: 'tunacore',
        discord: createMockUser({ id: '111111' }),
        rank: 'Elite 4',
      },
    });

    fetchClient.post.mockResolvedValue({
      data: {
        data: {
          id: 'member-123',
          ign: 'tunacore',
          discord_id: '111111',
          rank: 'Elite 4',
        },
      },
    });

    await handleAddMember(interaction);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(fetchClient.post).toHaveBeenCalledWith(
      'http://localhost:3001/api/members',
      expect.objectContaining({
        ign: 'tunacore',
        discord_id: '111111',
        rank: 'Elite 4',
      }),
      expect.any(Object)
    );
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
      })
    );
  });

  it('returns member information', async () => {
    const interaction = createMockInteraction({
      options: { ign: 'tunacore' },
    });

    fetchClient.get.mockResolvedValue({
      data: {
        data: {
          id: 'member-123',
          ign: 'tunacore',
          rank: 'Elite 4',
          join_date: '2024-01-15',
          shiny_count: 50,
          discord_id: '111111',
        },
      },
    });

    await handleGetMember(interaction);

    expect(fetchClient.get).toHaveBeenCalledWith(
      'http://localhost:3001/api/members/ign/tunacore',
      expect.any(Object)
    );
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
      })
    );
  });

  it('handles missing members', async () => {
    const interaction = createMockInteraction({
      options: { ign: 'missing' },
    });

    const error = new Error('not found');
    error.response = { status: 404 };
    fetchClient.get.mockRejectedValue(error);

    await handleGetMember(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('not found'),
      })
    );
  });
});
