const { createCatchEventsRepository } = require('../src/cloudflare/catch-events-repository');

describe('Cloudflare catch events repository', () => {
  it('filters private events out of the public event list', async () => {
    const runCommand = jest.fn().mockResolvedValue({});
    const runOne = jest.fn();
    const runSelect = jest.fn()
      .mockResolvedValueOnce([
        { name: 'id' },
        { name: 'submissions_closed' },
        { name: 'is_private' },
      ])
      .mockResolvedValueOnce([]);
    const repository = createCatchEventsRepository({
      dialect: 'd1',
      parameter: (index) => `?${index}`,
      runCommand,
      runOne,
      runSelect,
    });

    await repository.listEvents();

    expect(runSelect.mock.calls[1][0]).toContain('is_private = 0');
  });

  it('keeps owner event lists searchable by owner even when events are private', async () => {
    const runCommand = jest.fn().mockResolvedValue({});
    const runOne = jest.fn();
    const runSelect = jest.fn()
      .mockResolvedValueOnce([
        { name: 'id' },
        { name: 'submissions_closed' },
        { name: 'is_private' },
      ])
      .mockResolvedValueOnce([]);
    const repository = createCatchEventsRepository({
      dialect: 'd1',
      parameter: (index) => `?${index}`,
      runCommand,
      runOne,
      runSelect,
    });

    await repository.listEvents({ ownerUserId: 'owner-1' });

    expect(runSelect.mock.calls[1][0]).toContain('owner_user_id = ?1');
    expect(runSelect.mock.calls[1][0]).not.toContain('is_private = 0');
  });

  it('adds D1 submission location columns before upserting into older local databases', async () => {
    const runCommand = jest.fn().mockResolvedValue({});
    const runOne = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'submission-1',
        event_id: 'event-1',
        player_ign: 'tunacore',
        species: 'Milotic',
        nature: 'Calm',
        total_iv: 140,
        catch_local: '2026-05-18T10:00:00',
        timezone: 'America/Los_Angeles',
        region: 'Hoenn',
        route: 'Route 119',
        catch_utc: '2026-05-18T17:00:00Z',
        score: 140,
        status: 'valid',
        flags_json: '[]',
        created_at: '2026-05-18T17:00:00Z',
        updated_at: '2026-05-18T17:00:00Z',
      });
    const runSelect = jest.fn()
      .mockResolvedValueOnce([
        { name: 'id' },
        { name: 'event_id' },
        { name: 'player_ign' },
      ])
      .mockResolvedValueOnce([]);
    const repository = createCatchEventsRepository({
      dialect: 'd1',
      parameter: () => '?',
      runCommand,
      runOne,
      runSelect,
    });

    await repository.upsertSubmission('event-1', {
      playerIgn: 'tunacore',
      species: 'Milotic',
      nature: 'Calm',
      totalIv: 140,
      catchLocal: '2026-05-18T10:00:00',
      timezone: 'America/Los_Angeles',
      region: 'Hoenn',
      route: 'Route 119',
      catchUtc: '2026-05-18T17:00:00Z',
      score: 140,
      status: 'valid',
      flags: [],
    });

    expect(runSelect).toHaveBeenNthCalledWith(1, 'PRAGMA table_info(catch_event_submissions)');
    expect(runCommand.mock.calls[0][0]).toContain('ADD COLUMN region');
    expect(runCommand.mock.calls[1][0]).toContain('ADD COLUMN route');
    expect(runCommand.mock.calls[2][0]).toContain('INSERT INTO catch_event_submissions');
  });
});
