jest.mock('../../server/src/config/connection', () => ({
  query: jest.fn(),
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn(() => 'CREATE TABLE test(id INT);'),
}));

jest.mock('path', () => ({
  join: jest.fn(() => '/fake/schema.sql'),
}));

const pool = require('../../server/src/config/connection');
const fs = require('fs');
const path = require('path');

describe('migrate script', () => {
  it('runs migrations and executes schema against the pool', () => {
    jest.isolateModules(() => {
      require('../../server/src/config/migrate');
    });

    expect(path.join).toHaveBeenCalled();
    expect(fs.readFileSync).toHaveBeenCalled();
    expect(pool.query).toHaveBeenCalledWith('CREATE TABLE test(id INT);');
  });
});
