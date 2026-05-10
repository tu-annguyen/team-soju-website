const { createFeebasRepository } = require('../src/cloudflare/feebas-repository');

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
});
