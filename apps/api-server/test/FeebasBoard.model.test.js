jest.mock('../src/config/connection', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

const pool = require('../src/config/connection');
const FeebasBoard = require('../src/models/FeebasBoard');

describe('FeebasBoard model', () => {
  beforeEach(() => {
    pool.query.mockReset();
    pool.connect.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  it('allows the pending voter to clear their own vote', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce()
        .mockResolvedValueOnce(),
      release: jest.fn(),
    };
    const cycle = {
      id: 45,
      cycle_start: '2026-04-10T00:00:00.000Z',
      cycle_end: '2026-04-10T00:45:00.000Z',
    };
    const board = { tiles: [] };

    pool.connect.mockResolvedValue(client);
    jest.spyOn(FeebasBoard, 'ensureCycle').mockResolvedValueOnce(cycle);
    jest.spyOn(FeebasBoard, 'getTileVotesForUpdate').mockResolvedValueOnce([
      {
        id: 100,
        actor_fingerprint: 'client-12345678',
        status: 'pending',
      },
    ]);
    jest.spyOn(FeebasBoard, 'getBoardForCycle').mockResolvedValueOnce(board);
    jest.spyOn(FeebasBoard, 'applyTileVote').mockResolvedValueOnce();
    jest.spyOn(FeebasBoard, 'insertActivityLog').mockResolvedValueOnce();

    const result = await FeebasBoard.updateTile('route-119-main', 'r1c8', {
      status: 'unchecked',
      actorFingerprint: 'client-12345678',
      actorName: 'May',
    }, {
      now: '2026-04-10T00:20:00.000Z',
    });

    expect(result).toEqual(board);
    expect(FeebasBoard.applyTileVote).toHaveBeenCalledWith(client, 45, 'r1c8', expect.objectContaining({
      currentVote: expect.objectContaining({
        id: 100,
        status: 'pending',
      }),
      nextStatus: 'unchecked',
      actorFingerprint: 'client-12345678',
    }));
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(2, 'COMMIT');
    expect(client.release).toHaveBeenCalled();

  });
});
