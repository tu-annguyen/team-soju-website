module.exports = {
  displayName: 'discord-bot',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app.js', // Skip class-based app entry point
    '!**/node_modules/**'
  ],
  clearMocks: true,
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/test/setup.js']
};
