module.exports = {
  rootDir: '.',
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/test/**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.ts'],
  globals: {
    'ts-jest': {
      // Use a separate TS config for tests so JSX is compiled correctly
      tsconfig: '<rootDir>/tsconfig.test.json'
    }
  }
};
