jest.mock('pg', () => {
  const mockOn = jest.fn();
  const Pool = jest.fn(() => ({ on: mockOn }));
  return { Pool, __mockOn: mockOn };
});

const { Pool, __mockOn } = require('pg');

describe('DB connection config', () => {
  it('initializes pg Pool with environment variables and registers event handlers', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
    process.env.NODE_ENV = 'production';

    const pool = require('../../server/src/config/connection');

    expect(Pool).toHaveBeenCalledTimes(1);
    const args = Pool.mock.calls[0][0];
    expect(args).toHaveProperty('connectionString', 'postgres://user:pass@localhost:5432/db');
    expect(args.ssl).toBeTruthy();

    expect(__mockOn).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(__mockOn).toHaveBeenCalledWith('error', expect.any(Function));

    expect(pool).toBeDefined();
  });
});
