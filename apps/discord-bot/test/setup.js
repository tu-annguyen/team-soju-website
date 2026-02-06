/**
 * Jest setup file
 * Configure global test utilities and mocks
 */

// Mock dotenv to avoid loading .env during tests
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

// Set test environment variables
process.env.API_BASE_URL = 'http://localhost:3001/api';
process.env.BOT_API_TOKEN = 'test-bot-token';
process.env.DISCORD_TOKEN = 'test-discord-token';
process.env.DISCORD_CLIENT_ID = 'test-client-id';
