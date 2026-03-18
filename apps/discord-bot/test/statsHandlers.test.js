const {
  handleLeaderboard,
  handleStats,
} = require('../src/handlers/statsHandlers');
const { createMockInteraction } = require('./fixtures/mockInteraction');

jest.mock('../src/fetchClient', () => ({
  get: jest.fn(),
}));

const fetchClient = require('../src/fetchClient');

describe('statsHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the leaderboard', async () => {
    const interaction = createMockInteraction({ options: { limit: 10 } });
    fetchClient.get.mockResolvedValue({
      data: {
        data: [
          { ign: 'tunacore', shiny_count: 10, secret_count: 1 },
        ],
      },
    });

    await handleLeaderboard(interaction);

    expect(fetchClient.get).toHaveBeenCalledWith(
      'http://localhost:3001/api/shinies/leaderboard?limit=10',
      expect.any(Object)
    );
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) })
    );
  });

  it('renders aggregate stats', async () => {
    const interaction = createMockInteraction();
    fetchClient.get
      .mockResolvedValueOnce({
        data: {
          data: [
            { encounter_type: 'horde', count_by_type: 5, secret_shinies: 1 },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ id: 'member-1' }, { id: 'member-2' }],
        },
      });

    await handleStats(interaction);

    expect(fetchClient.get).toHaveBeenCalledTimes(2);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) })
    );
  });
});
