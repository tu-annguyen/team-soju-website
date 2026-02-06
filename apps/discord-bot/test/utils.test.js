/**
 * Tests for utility functions
 */

const {
  getCommandHandlers,
  getCommandHandler
} = require('../src/utils');

// Mock the handler modules
jest.mock('../src/handlers/memberHandlers', () => ({
  handleAddMember: jest.fn(),
  handleEditMember: jest.fn(),
  handleDeleteMember: jest.fn(),
  handleReactivateMember: jest.fn(),
  handleGetMember: jest.fn()
}));

jest.mock('../src/handlers/shinyHandlers', () => ({
  handleAddShiny: jest.fn(),
  handleAddShinyScreenshot: jest.fn(),
  handleEditShiny: jest.fn(),
  handleDeleteShiny: jest.fn(),
  handleGetShiny: jest.fn(),
  handleGetShinies: jest.fn()
}));

jest.mock('../src/handlers/statsHandlers', () => ({
  handleLeaderboard: jest.fn(),
  handleStats: jest.fn()
}));

describe('Utils', () => {
  describe('getCommandHandlers', () => {
    it('should return memberHandlers for member commands', () => {
      const handlers = getCommandHandlers('addmember');
      expect(handlers).toHaveProperty('handleAddMember');
    });

    it('should return shinyHandlers for shiny commands', () => {
      const handlers = getCommandHandlers('addshiny');
      expect(handlers).toHaveProperty('handleAddShiny');
    });

    it('should return statsHandlers for stats commands', () => {
      const handlers = getCommandHandlers('leaderboard');
      expect(handlers).toHaveProperty('handleLeaderboard');
    });

    it('should throw error for unknown command', () => {
      expect(() => {
        getCommandHandlers('unknowncommand');
      }).toThrow('No handler found for command: unknowncommand');
    });
  });

  describe('getCommandHandler', () => {
    it('should return handleAddMember for addmember command', () => {
      const handler = getCommandHandler('addmember');
      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });

    it('should return handleEditMember for editmember command', () => {
      const handler = getCommandHandler('editmember');
      expect(handler).toBeDefined();
    });

    it('should return handleDeleteMember for deletemember command', () => {
      const handler = getCommandHandler('deletemember');
      expect(handler).toBeDefined();
    });

    it('should return handleReactivateMember for reactivatemember command', () => {
      const handler = getCommandHandler('reactivatemember');
      expect(handler).toBeDefined();
    });

    it('should return handleGetMember for member command', () => {
      const handler = getCommandHandler('member');
      expect(handler).toBeDefined();
    });

    it('should return handleAddShiny for addshiny command', () => {
      const handler = getCommandHandler('addshiny');
      expect(handler).toBeDefined();
    });

    it('should return handleAddShinyScreenshot for addshinyscreenshot command', () => {
      const handler = getCommandHandler('addshinyscreenshot');
      expect(handler).toBeDefined();
    });

    it('should return handleEditShiny for editshiny command', () => {
      const handler = getCommandHandler('editshiny');
      expect(handler).toBeDefined();
    });

    it('should return handleDeleteShiny for deleteshiny command', () => {
      const handler = getCommandHandler('deleteshiny');
      expect(handler).toBeDefined();
    });

    it('should return handleGetShiny for shiny command', () => {
      const handler = getCommandHandler('shiny');
      expect(handler).toBeDefined();
    });

    it('should return handleGetShinies for shinies command', () => {
      const handler = getCommandHandler('shinies');
      expect(handler).toBeDefined();
    });

    it('should return handleLeaderboard for leaderboard command', () => {
      const handler = getCommandHandler('leaderboard');
      expect(handler).toBeDefined();
    });

    it('should return handleStats for stats command', () => {
      const handler = getCommandHandler('stats');
      expect(handler).toBeDefined();
    });

    it('should throw error for unknown command', () => {
      expect(() => {
        getCommandHandler('unknowncommand');
      }).toThrow('No handler found for command: unknowncommand');
    });
  });
});
