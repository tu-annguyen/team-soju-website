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
    expect(pool.query).toHaveBeenNthCalledWith(2, expect.stringContaining('WHERE location = $1 AND cycle_start < $2'), [
      'route-119-main',
      '2026-04-10T00:00:00.000Z',
    ]);
    expect(pool.query).toHaveBeenNthCalledWith(3, expect.stringContaining('ON CONFLICT (location, cycle_start) DO NOTHING'), [
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
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [cycle] });

    const result = await FeebasBoard.ensureCycle(
      pool,
      'route-119-main',
      new Date('2026-04-10T00:00:00.000Z'),
      new Date('2026-04-10T00:45:00.000Z'),
    );

    expect(result).toEqual(cycle);
    expect(pool.query).toHaveBeenCalledTimes(4);
    expect(pool.query).toHaveBeenNthCalledWith(4, expect.stringContaining('SELECT *'), [
      'route-119-main',
      '2026-04-10T00:00:00.000Z',
    ]);
  });

  it('returns ranked logged-in Feebas leaderboard stats', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            user_id: 'user-1',
            ign: 'May',
            verified_discoveries: '2',
            feebas_uptime_created_minutes: '180',
            confirmations: '4',
            search_coverage: '30',
            weekly_contribution_score: '212',
            all_time_contribution_score: '363',
            fastest_find_seconds: '90',
            early_scout_seconds: '30',
            efficiency: '0.0666666667',
            report_accuracy: '0.8',
            most_persistent_checks: '17',
            pending_reports: '5',
            verified_reports: '4',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            user_id: 'user-1',
            cycle_id: 45,
            cycle_start: '2026-04-10T00:45:00.000Z',
          },
          {
            user_id: 'user-1',
            cycle_id: 44,
            cycle_start: '2026-04-10T00:00:00.000Z',
          },
        ],
      });

    const result = await FeebasBoard.getLeaderboard('route-119-main', {
      now: '2026-04-10T01:00:00.000Z',
      weeklySince: '2026-04-03T01:00:00.000Z',
      limit: 5,
    });

    expect(result).toEqual(expect.objectContaining({
      location: 'route-119-main',
      generatedAt: '2026-04-10T01:00:00.000Z',
      weeklySince: '2026-04-03T01:00:00.000Z',
      sort: {
        by: 'rank',
        direction: 'asc',
      },
      sortOptions: expect.arrayContaining([
        { key: 'ign', defaultDirection: 'asc' },
        { key: 'currentStreak', defaultDirection: 'desc' },
      ]),
      entries: [
        {
          rank: 1,
          userId: 'user-1',
          ign: 'May',
          verifiedDiscoveries: 2,
          feebasUptimeCreatedMinutes: 180,
          confirmations: 4,
          searchCoverage: 30,
          weeklyContributionScore: 212,
          allTimeContributionScore: 363,
          fastestFindSeconds: 90,
          earlyScoutSeconds: 30,
          efficiency: 0.0666666667,
          reportAccuracy: 0.8,
          currentStreak: 2,
          mostPersistentChecks: 17,
          pendingReports: 5,
          verifiedReports: 4,
        },
      ],
    }));
    expect(pool.query).toHaveBeenNthCalledWith(1, expect.stringContaining('verified_discoveries'), [
      'route-119-main',
      '2026-04-03T01:00:00.000Z',
    ]);
    const leaderboardSql = pool.query.mock.calls[0][0];
    expect(leaderboardSql).toContain('resolved_pending_reports AS');
    expect(leaderboardSql).toContain('early_scout_seconds');
    expect(leaderboardSql).toContain("activity.next_status IN ('checked', 'confirmed')");
    expect(leaderboardSql).toContain('FROM resolved_pending_reports reports');
    expect(leaderboardSql).toContain("reports.resolved_status = 'confirmed'");
    expect(pool.query).toHaveBeenNthCalledWith(2, expect.stringContaining('GROUP BY user_id, cycle_id, cycle_start'), [
      'route-119-main',
    ]);
  });

  it('can build a board without recomputing leaderboard stats', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const cycle = {
      id: 45,
      cycle_start: '2026-04-10T00:00:00.000Z',
      cycle_end: '2026-04-10T00:45:00.000Z',
    };
    const getLeaderboardSpy = jest.spyOn(FeebasBoard, 'getLeaderboard');

    const result = await FeebasBoard.getBoardForCycle(
      client,
      'route-119-main',
      cycle,
      new Date('2026-04-10T00:20:00.000Z'),
      'client-12345678',
      { includeLeaderboard: false },
    );

    expect(result).not.toHaveProperty('leaderboard');
    expect(result.tiles.length).toBeGreaterThan(0);
    expect(getLeaderboardSpy).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledTimes(3);
  });

  it('masks unsigned activity names as anonymous while preserving signed-in IGNs', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              tile_id: 'r1c1',
              tile_label: 'A1',
              action_type: 'voted',
              previous_status: 'unchecked',
              next_status: 'checked',
              actor_name: 'Guest Custom Name',
              actor_fingerprint: 'client-12345678',
              created_at: '2026-04-10T00:10:00.000Z',
            },
            {
              id: 2,
              tile_id: 'r1c2',
              tile_label: 'A2',
              action_type: 'confirmed',
              previous_status: 'pending',
              next_status: 'confirmed',
              actor_name: 'Trainer',
              actor_fingerprint: 'account-user-1',
              created_at: '2026-04-10T00:12:00.000Z',
            },
          ],
        }),
    };

    const result = await FeebasBoard.getBoardForCycle(
      client,
      'route-119-main',
      {
        id: 45,
        cycle_start: '2026-04-10T00:00:00.000Z',
        cycle_end: '2026-04-10T00:45:00.000Z',
      },
      new Date('2026-04-10T00:20:00.000Z'),
      'client-12345678',
      { includeLeaderboard: false },
    );

    expect(result.activity).toEqual([
      expect.objectContaining({
        id: 1,
        actorName: null,
      }),
      expect.objectContaining({
        id: 2,
        actorName: 'Trainer',
      }),
    ]);
  });

  it('archives confirmed tiles from the previous cycle before creating a new one', async () => {
    const previousCycle = {
      id: 41,
      location: 'route-119-main',
      cycle_start: '2026-04-09T23:15:00.000Z',
      cycle_end: '2026-04-10T00:00:00.000Z',
    };
    const nextCycle = {
      id: 43,
      location: 'route-119-main',
      cycle_start: '2026-04-10T00:00:00.000Z',
      cycle_end: '2026-04-10T00:45:00.000Z',
    };

    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [previousCycle] })
      .mockResolvedValueOnce({
        rows: [
          { tile_id: 'r3c8', confirmed_vote_count: 2 },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ inserted: true }] })
      .mockResolvedValueOnce({ rows: [nextCycle] });

    const result = await FeebasBoard.ensureCycle(
      pool,
      'route-119-main',
      new Date('2026-04-10T00:00:00.000Z'),
      new Date('2026-04-10T00:45:00.000Z'),
    );

    expect(result).toEqual(nextCycle);
    expect(pool.query).toHaveBeenNthCalledWith(3, expect.stringContaining("WHERE cycle_id = $1 AND status = 'confirmed'"), [
      41,
    ]);
    expect(pool.query).toHaveBeenNthCalledWith(4, expect.stringContaining('INSERT INTO feebas_confirmed_tile_snapshots'), [
      'route-119-main',
      41,
      '2026-04-09T23:15:00.000Z',
      '2026-04-10T00:00:00.000Z',
      'r3c8',
      'H13',
      2,
      expect.any(String),
    ]);
  });

  it('archives confirmed tiles before deleting the active cycle during reset', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce()
        .mockResolvedValueOnce({
          rows: [{
            id: 88,
            location: 'route-119-main',
            cycle_start: '2026-04-10T00:00:00.000Z',
            cycle_end: '2026-04-10T00:45:00.000Z',
          }],
        })
        .mockResolvedValueOnce({
          rows: [{ tile_id: 'r3c8', confirmed_vote_count: 1 }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce()
        .mockResolvedValueOnce(),
      release: jest.fn(),
    };
    const board = { tiles: [] };

    pool.connect.mockResolvedValue(client);
    jest.spyOn(FeebasBoard, 'getBoard').mockResolvedValueOnce(board);

    const result = await FeebasBoard.resetBoard('route-119-main', {
      now: '2026-04-10T00:20:00.000Z',
    });

    expect(result).toEqual(board);
    expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining('WHERE location = $1 AND cycle_start = $2'), [
      'route-119-main',
      '2026-04-10T00:00:00.000Z',
    ]);
    expect(client.query).toHaveBeenNthCalledWith(3, expect.stringContaining("WHERE cycle_id = $1 AND status = 'confirmed'"), [
      88,
    ]);
    expect(client.query).toHaveBeenNthCalledWith(4, expect.stringContaining('INSERT INTO feebas_confirmed_tile_snapshots'), [
      'route-119-main',
      88,
      '2026-04-10T00:00:00.000Z',
      '2026-04-10T00:45:00.000Z',
      'r3c8',
      'H13',
      1,
      '2026-04-10T00:20:00.000Z',
    ]);
    expect(client.query).toHaveBeenNthCalledWith(5, expect.stringContaining('DELETE FROM feebas_cycles'), [
      'route-119-main',
      '2026-04-10T00:00:00.000Z',
    ]);
    expect(FeebasBoard.getBoard).toHaveBeenCalledWith('route-119-main', {
      client,
      now: new Date('2026-04-10T00:20:00.000Z'),
    });
    expect(client.query).toHaveBeenNthCalledWith(6, 'COMMIT');
    expect(client.release).toHaveBeenCalled();
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
