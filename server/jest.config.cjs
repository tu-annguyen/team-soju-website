module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  // Allow tests under /test to resolve backend deps installed in /server/node_modules
  moduleDirectories: ['node_modules', 'server/node_modules'],
  testMatch: ['<rootDir>/test/server/**/*.test.js'],
  collectCoverageFrom: [
    'server/src/**/*.js',
    '!server/src/discord/**'
  ]
};
