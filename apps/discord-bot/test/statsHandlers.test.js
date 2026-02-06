/**
 * Tests for stats command handlers
 */

// Mock discord.js EmbedBuilder FIRST before any imports
class MockEmbedBuilder {
  setColor() { return this; }
  setTitle() { return this; }
  setDescription() { return this; }
  addFields() { return this; }
  setFooter() { return this; }
  setTimestamp() { return this; }
}

jest.mock('discord.js', () => ({
  EmbedBuilder: MockEmbedBuilder
}));

// Mock axios for HTTP requests
jest.mock('axios');

const {
  handleLeaderboard,
  handleStats
} = require('../src/handlers/statsHandlers');
const { createMockInteraction } = require('./fixtures/mockInteraction');
const axios = require('axios');

describe('Stats Handlers', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('handleLeaderboard', () => {
    it('should retrieve leaderboard with default limit', async () => {
      const interaction = createMockInteraction({
        options: {
          limit: null
        }
      });

      axios.get.mockResolvedValue({
        data: {
          data: [
            { ign: 'tunacore', shiny_count: 150, secret_count: 5 },
            { ign: 'player2', shiny_count: 120, secret_count: 2 },
            { ign: 'player3', shiny_count: 95, secret_count: 0 }
          ]
        }
      });

      await handleLeaderboard(interaction);

      expect(axios.get).toHaveBeenCalledWith(
        'http://localhost:3001/api/shinies/leaderboard?limit=10',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-bot-token' }
        })
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array)
        })
      );
    });

    it('should retrieve leaderboard with custom limit', async () => {
      const interaction = createMockInteraction({
        options: {
          limit: 20
        }
      });

      axios.get.mockResolvedValue({
        data: {
          data: Array.from({ length: 20 }, (_, i) => ({
            ign: `player${i + 1}`,
            shiny_count: 100 - i * 5,
            secret_count: Math.floor(Math.random() * 5)
          }))
        }
      });

      await handleLeaderboard(interaction);

      expect(axios.get).toHaveBeenCalledWith(
        'http://localhost:3001/api/shinies/leaderboard?limit=20',
        expect.any(Object)
      );
    });

    it('should handle empty leaderboard', async () => {
      const interaction = createMockInteraction({
        options: {
          limit: 10
        }
      });

      axios.get.mockResolvedValue({
        data: {
          data: []
        }
      });

      await handleLeaderboard(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'No data available for leaderboard'
        })
      );
    });

    it('should show secret shiny count when present', async () => {
      const interaction = createMockInteraction({
        options: {
          limit: 10
        }
      });

      axios.get.mockResolvedValue({
        data: {
          data: [
            { ign: 'secrethunter', shiny_count: 80, secret_count: 15 },
            { ign: 'regularplayer', shiny_count: 70, secret_count: 0 }
          ]
        }
      });

      await handleLeaderboard(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array)
        })
      );
    });

    it('should handle API errors', async () => {
      const interaction = createMockInteraction({
        options: {
          limit: 10
        }
      });

      axios.get.mockRejectedValue(new Error('API connection failed'));

      await handleLeaderboard(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Error')
        })
      );
    });
  });

  describe('handleStats', () => {
    it('should retrieve team statistics', async () => {
      const interaction = createMockInteraction();

      axios.get.mockResolvedValueOnce({
        data: {
          data: [
            { encounter_type: 'Horde', count_by_type: 150, secret_shinies: 5 },
            { encounter_type: 'Random', count_by_type: 200, secret_shinies: 10 },
            { encounter_type: 'Static', count_by_type: 100, secret_shinies: 3 }
          ]
        }
      }).mockResolvedValueOnce({
        data: {
          data: [
            { id: 'member-1', ign: 'player1' },
            { id: 'member-2', ign: 'player2' },
            { id: 'member-3', ign: 'player3' }
          ]
        }
      });

      await handleStats(interaction);

      expect(axios.get).toHaveBeenCalledTimes(2);
      expect(axios.get).toHaveBeenNthCalledWith(
        1,
        'http://localhost:3001/api/shinies/stats',
        expect.any(Object)
      );
      expect(axios.get).toHaveBeenNthCalledWith(
        2,
        'http://localhost:3001/api/members',
        expect.any(Object)
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array)
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      const interaction = createMockInteraction();

      axios.get.mockRejectedValue(new Error('Database connection error'));

      await handleStats(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Error')
        })
      );
    });
  });
});
