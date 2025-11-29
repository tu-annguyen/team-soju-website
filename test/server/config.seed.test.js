jest.mock('../../server/src/config/connection', () => ({
  query: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(),
}));

jest.mock('path', () => ({
  resolve: jest.fn(() => '/fake/showcase.json'),
}));

const pool = require('../../server/src/config/connection');

describe('seed script', () => {
  it('seeds sample members and attempts to read showcase JSON if present', async () => {
    let fsMock;
    let pathMock;

    jest.isolateModules(() => {
      // Require within the isolated module registry so we get the same
      // mock instances that seed.js uses internally.
      fsMock = require('fs');
      pathMock = require('path');
      require('../../server/src/config/seed');
    });

    // Allow the async seedDatabase function a tick to run to completion.
    await new Promise((resolve) => setImmediate(resolve));

    // Should have inserted at least one member
    expect(pool.query).toHaveBeenCalled();
    expect(fsMock.existsSync).toHaveBeenCalledWith('/fake/showcase.json');
    expect(pathMock.resolve).toHaveBeenCalled();
  });
});
