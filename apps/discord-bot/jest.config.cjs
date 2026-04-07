module.exports = {
  displayName: 'discord-bot',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!**/node_modules/**'
  ],
  clearMocks: true,
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/test/setup.js']
};
