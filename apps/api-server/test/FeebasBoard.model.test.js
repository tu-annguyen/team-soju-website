jest.mock('../src/config/connection', () => ({
  query: jest.fn(),
}));

const pool = require('../src/config/connection');
const FeebasBoard = require('../src/models/FeebasBoard');

describe('FeebasBoard model', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  it('returns an existing cycle without rewriting it', async () => {
    const cycle = {
      id: 42,
      location: 'route-119-main',
      cycle_start: '2026-04-10T00:00:00.000Z',
      cycle_end: '2026-04-10T00:45:00.000Z',
    };
    pool.query.mockResolvedValueOnce({ rows: [cycle] });

    const result = await FeebasBoard.ensureCycle(
      pool,
      'route-119-main',
      new Date('2026-04-10T00:00:00.000Z'),
      new Date('2026-04-10T00:45:00.000Z'),
    );

    expect(result).toEqual(cycle);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT *'), [
      'route-119-main',
      '2026-04-10T00:00:00.000Z',
    ]);
  });

  it('inserts a cycle when one does not exist', async () => {
    const cycle = {
      id: 43,
      location: 'route-119-main',
      cycle_start: '2026-04-10T00:00:00.000Z',
      cycle_end: '2026-04-10T00:45:00.000Z',
    };
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [cycle] });

    const result = await FeebasBoard.ensureCycle(
      pool,
      'route-119-main',
      new Date('2026-04-10T00:00:00.000Z'),
      new Date('2026-04-10T00:45:00.000Z'),
    );

    expect(result).toEqual(cycle);
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query).toHaveBeenNthCalledWith(2, expect.stringContaining('ON CONFLICT (location, cycle_start) DO NOTHING'), [
      'route-119-main',
      '2026-04-10T00:00:00.000Z',
      '2026-04-10T00:45:00.000Z',
    ]);
  });

  it('loads the cycle after a concurrent insert wins the race', async () => {
    const cycle = {
      id: 44,
      location: 'route-119-main',
      cycle_start: '2026-04-10T00:00:00.000Z',
      cycle_end: '2026-04-10T00:45:00.000Z',
    };
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [cycle] });

    const result = await FeebasBoard.ensureCycle(
      pool,
      'route-119-main',
      new Date('2026-04-10T00:00:00.000Z'),
      new Date('2026-04-10T00:45:00.000Z'),
    );

    expect(result).toEqual(cycle);
    expect(pool.query).toHaveBeenCalledTimes(3);
    expect(pool.query).toHaveBeenNthCalledWith(3, expect.stringContaining('SELECT *'), [
      'route-119-main',
      '2026-04-10T00:00:00.000Z',
    ]);
  });
});
