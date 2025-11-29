module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  // (Not neeeded with workspaces setup?) Allow tests under /test to resolve backend deps installed in /server/node_modules 
  // moduleDirectories: ['node_modules', 'server/node_modules'],
  testMatch: ['<rootDir>/test/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/discord/**'
  ]
};
