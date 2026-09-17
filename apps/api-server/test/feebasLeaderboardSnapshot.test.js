const { createFeebasLeaderboard } = require('../src/cloudflare/repositories/feebas-leaderboard');

function snapshot(overrides = {}) {
  return {
    scope: 'route-119-main+route-119-upstream',
    generated_at: '2026-09-16T00:00:00.000Z',
    weekly_since: '2026-09-09T00:00:00.000Z',
    next_weekly_expiration: '2026-09-18T00:00:00.000Z',
    dirty: 0,
    entries_json: JSON.stringify([
      { userId: 'one', ign: 'Alpha', allTimeContributionScore: 10, weeklyContributionScore: 1 },
      { userId: 'two', ign: 'Beta', allTimeContributionScore: 20, weeklyContributionScore: 2 },
    ]),
    ...overrides,
  };
}

describe('Feebas leaderboard snapshots', () => {
  it('sorts and pins the current user from the small canonical snapshot', async () => {
    const service = createFeebasLeaderboard({
      dialect: 'd1',
      parameter: (index) => `?${index}`,
      runCommand: jest.fn(),
      runOne: jest.fn().mockResolvedValue(snapshot()),
      runSelect: jest.fn(),
    });

    const result = await service.getLeaderboard('route-119-main', {
      now: '2026-09-16T12:00:00.000Z',
      limit: 1,
      currentUserId: 'one',
    });

    expect(result.entries.map(({ userId, rank }) => [userId, rank])).toEqual([['two', 1], ['one', 2]]);
  });

  it('returns stale data immediately and schedules one leased rebuild', async () => {
    const stale = snapshot({ dirty: 1 });
    const runCommand = jest.fn().mockResolvedValue({ meta: { changes: 1 } });
    const runSelect = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const promises = [];
    const service = createFeebasLeaderboard({
      dialect: 'd1',
      parameter: (index) => `?${index}`,
      runCommand,
      runOne: jest.fn().mockResolvedValue(stale),
      runSelect,
    });

    const result = await service.getLeaderboard('route-119-main', {
      now: '2026-09-16T12:00:00.000Z',
      waitUntil: (promise) => promises.push(promise),
    });

    expect(result.generatedAt).toBe(stale.generated_at);
    expect(promises).toHaveLength(1);
    await promises[0];
    expect(runSelect).toHaveBeenCalledTimes(2);
    expect(runCommand.mock.calls[0][0]).toContain('refresh_lease_until');
    expect(runCommand.mock.calls.at(-1)[0]).toContain('entries_json=excluded.entries_json');
  });
});
