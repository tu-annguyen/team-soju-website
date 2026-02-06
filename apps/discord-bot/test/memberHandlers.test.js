/**
 * Tests for member command handlers
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

const {
  handleAddMember,
  handleEditMember,
  handleDeleteMember,
  handleGetMember,
  handleReactivateMember
} = require('../src/handlers/memberHandlers');
const { createMockInteraction, createMockUser } = require('./fixtures/mockInteraction');

// Mock axios for HTTP requests
jest.mock('axios');
const axios = require('axios');

describe('Member Handlers', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('handleAddMember', () => {
    it('should add a member successfully', async () => {
      const mockUser = createMockUser({ id: '111111', username: 'testuser' });
      const interaction = createMockInteraction({
        options: {
          ign: 'tunacore',
          discord: mockUser,
          rank: 'Elite 4'
        }
      });

      axios.post.mockResolvedValue({
        data: {
          data: {
            id: 'member-123',
            ign: 'tunacore',
            discord_id: '111111',
            rank: 'Elite 4'
          }
        }
      });

      await handleAddMember(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3001/api/members',
        {
          ign: 'tunacore',
          discord_id: '111111',
          rank: 'Elite 4'
        },
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

    it('should use default rank if not provided', async () => {
      const interaction = createMockInteraction({
        options: {
          ign: 'newplayer',
          discord: null,
          rank: null
        }
      });

      axios.post.mockResolvedValue({
        data: {
          data: {
            id: 'member-124',
            ign: 'newplayer',
            rank: 'Trainer'
          }
        }
      });

      await handleAddMember(interaction);

      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3001/api/members',
        expect.objectContaining({ rank: 'Trainer' }),
        expect.any(Object)
      );
    });

    it('should handle API errors gracefully', async () => {
      const interaction = createMockInteraction({
        options: {
          ign: 'invalid',
          discord: null,
          rank: 'Trainer'
        }
      });

      axios.post.mockRejectedValue({
        response: {
          data: { message: 'Member already exists' }
        }
      });

      await handleAddMember(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Member already exists')
        })
      );
    });

    it('should include Discord mention if user provided', async () => {
      const mockUser = createMockUser();
      const interaction = createMockInteraction({
        options: {
          ign: 'player1',
          discord: mockUser,
          rank: 'Trainer'
        }
      });

      axios.post.mockResolvedValue({
        data: {
          data: {
            id: 'member-125',
            ign: 'player1',
            discord_id: mockUser.id,
            rank: 'Trainer'
          }
        }
      });

      await handleAddMember(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array)
        })
      );
    });
  });

  describe('handleGetMember', () => {
    it('should retrieve member information successfully', async () => {
      const interaction = createMockInteraction({
        options: {
          ign: 'tunacore'
        }
      });

      axios.get.mockResolvedValue({
        data: {
          data: {
            id: 'member-123',
            ign: 'tunacore',
            rank: 'Elite 4',
            join_date: '2024-01-15T00:00:00Z',
            shiny_count: 50,
            discord_id: '111111'
          }
        }
      });

      await handleGetMember(interaction);

      expect(axios.get).toHaveBeenCalledWith(
        'http://localhost:3001/api/members/ign/tunacore',
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

    it('should handle member not found error', async () => {
      const interaction = createMockInteraction({
        options: {
          ign: 'nonexistent'
        }
      });

      axios.get.mockRejectedValue({
        response: { status: 404 }
      });

      await handleGetMember(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('not found')
        })
      );
    });

    it('should show member info without Discord ID if not linked', async () => {
      const interaction = createMockInteraction({
        options: {
          ign: 'unlinked'
        }
      });

      axios.get.mockResolvedValue({
        data: {
          data: {
            id: 'member-126',
            ign: 'unlinked',
            rank: 'Trainer',
            join_date: '2025-01-01T00:00:00Z',
            shiny_count: 5,
            discord_id: null
          }
        }
      });

      await handleGetMember(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array)
        })
      );
    });
  });

  describe('handleEditMember', () => {
    it('should edit member successfully with new rank', async () => {
      const interaction = createMockInteraction({
        options: {
          ign: 'tunacore',
          new_ign: null,
          discord: null,
          rank: 'Champion'
        }
      });

      axios.get.mockResolvedValue({
        data: {
          data: {
            id: 'member-123',
            ign: 'tunacore'
          }
        }
      });

      axios.put.mockResolvedValue({
        data: {
          data: {
            id: 'member-123',
            ign: 'tunacore',
            rank: 'Champion',
            discord_id: null
          }
        }
      });

      await handleEditMember(interaction);

      expect(axios.get).toHaveBeenCalledWith(
        'http://localhost:3001/api/members/ign/tunacore',
        expect.any(Object)
      );
      expect(axios.put).toHaveBeenCalledWith(
        'http://localhost:3001/api/members/member-123',
        { rank: 'Champion' },
        expect.any(Object)
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array)
        })
      );
    });

    it('should not update if no changes provided', async () => {
      const interaction = createMockInteraction({
        options: {
          ign: 'tunacore',
          new_ign: null,
          discord: null,
          rank: null
        }
      });

      axios.get.mockResolvedValue({
        data: {
          data: {
            id: 'member-123',
            ign: 'tunacore'
          }
        }
      });

      await handleEditMember(interaction);

      expect(axios.put).not.toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'No updates provided'
        })
      );
    });
  });

  describe('handleDeleteMember', () => {
    it('should delete member successfully', async () => {
      const interaction = createMockInteraction({
        options: {
          ign: 'oldplayer'
        }
      });

      axios.get.mockResolvedValue({
        data: {
          data: {
            id: 'member-127',
            ign: 'oldplayer'
          }
        }
      });

      axios.delete.mockResolvedValue({ status: 200 });

      await handleDeleteMember(interaction);

      expect(axios.delete).toHaveBeenCalledWith(
        'http://localhost:3001/api/members/member-127',
        expect.any(Object)
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array)
        })
      );
    });
  });

  describe('handleReactivateMember', () => {
    it('should reactivate a deleted member', async () => {
      const interaction = createMockInteraction({
        options: {
          ign: 'oldplayer'
        }
      });

      axios.get.mockResolvedValue({
        data: {
          data: {
            id: 'member-127',
            ign: 'oldplayer',
            rank: 'Trainer',
            discord_id: null
          }
        }
      });

      axios.put.mockResolvedValue({ status: 200 });

      await handleReactivateMember(interaction);

      expect(axios.put).toHaveBeenCalledWith(
        'http://localhost:3001/api/members/reactivate/member-127',
        {},
        expect.any(Object)
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array)
        })
      );
    });
  });
});
