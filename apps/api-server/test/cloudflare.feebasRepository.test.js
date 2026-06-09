const { createFeebasRepository } = require('../src/cloudflare/repositories/feebas');

describe('Cloudflare Feebas repository', () => {
  it('binds both created_at and updated_at values when inserting D1 tile votes', async () => {
    const runCommand = jest.fn().mockResolvedValue({});
    const runOne = jest.fn().mockResolvedValue({
      id: 1,
      location: 'route-119-main',
      cycle_start: '2026-05-10T00:00:00.000Z',
      cycle_end: '2026-05-10T00:45:00.000Z',
    });
    const runSelect = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const repository = createFeebasRepository({
      dialect: 'd1',
      parameter: () => '?',
      runCommand,
      runOne,
      runSelect,
    });

    await repository.updateTile('route-119-main', 'r1c8', {
      status: 'checked',
      actorFingerprint: 'client-12345678',
      actorName: 'D1SmokeTest',
    }, {
      includeLeaderboard: false,
      now: '2026-05-10T00:05:00.000Z',
    });

    const [voteSql, voteParams] = runCommand.mock.calls[0];
    expect((voteSql.match(/\?/g) || []).length).toBe(7);
    expect(voteParams).toEqual([
      1,
      'r1c8',
      'client-12345678',
      'D1SmokeTest',
      'checked',
      '2026-05-10T00:05:00.000Z',
      '2026-05-10T00:05:00.000Z',
    ]);
  });

  it('reuses fresh leaderboard results instead of rereading all D1 activity logs', async () => {
    const runCommand = jest.fn().mockResolvedValue({});
    const runOne = jest.fn().mockResolvedValue(null);
    const runSelect = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const repository = createFeebasRepository({
      dialect: 'd1',
      parameter: () => '?',
      runCommand,
      runOne,
      runSelect,
    });

    const options = {
      now: '2026-05-10T00:05:00.000Z',
      limit: 5,
    };

    const firstLeaderboard = await repository.getLeaderboard('route-119-main', options);
    const secondLeaderboard = await repository.getLeaderboard('route-119-main', options);
    const upstreamLeaderboard = await repository.getLeaderboard('route-119-upstream', options);

    expect(runSelect).toHaveBeenCalledTimes(2);
    expect(firstLeaderboard).toEqual(secondLeaderboard);
    expect(upstreamLeaderboard).toEqual({
      ...firstLeaderboard,
      location: 'route-119-upstream',
    });
    expect(firstLeaderboard.entries).toEqual([]);
    expect(runSelect.mock.calls[0][0]).toContain('WHERE logs.location IN (?, ?)');
    expect(runSelect.mock.calls[0][1]).toEqual(['route-119-main', 'route-119-upstream']);
  });

  it('fetches Feebas activity after a last activity cursor for the current cycle', async () => {
    const runCommand = jest.fn().mockResolvedValue({});
    const runOne = jest.fn().mockResolvedValue({
      id: 5,
      location: 'route-119-main',
      cycle_start: '2026-05-10T00:00:00.000Z',
      cycle_end: '2026-05-10T00:45:00.000Z',
    });
    const runSelect = jest.fn().mockResolvedValue([{
      id: 8,
      tile_id: 'r1c8',
      tile_label: 'H15',
      action_type: 'voted',
      previous_status: 'unchecked',
      next_status: 'pending',
      actor_name: 'Trainer',
      created_at: '2026-05-10T00:06:00.000Z',
    }]);
    const repository = createFeebasRepository({
      dialect: 'd1',
      parameter: () => '?',
      runCommand,
      runOne,
      runSelect,
    });

    const delta = await repository.getActivityDeltaSince('route-119-main', 7, {
      now: '2026-05-10T00:05:00.000Z',
    });

    const [activitySql, activityParams] = runSelect.mock.calls[0];
    expect(activitySql).toContain('id > ?');
    expect(activityParams).toEqual([5, 7]);
    expect(delta).toEqual(expect.objectContaining({
      location: 'route-119-main',
      cycleStart: '2026-05-10T00:00:00.000Z',
      cycleEnd: '2026-05-10T00:45:00.000Z',
      activity: [{
        id: 8,
        tileId: 'r1c8',
        tileLabel: 'H15',
        actionType: 'voted',
        previousStatus: 'unchecked',
        nextStatus: 'pending',
        actorName: 'Trainer',
        createdAt: '2026-05-10T00:06:00.000Z',
      }],
    }));
  });
});
