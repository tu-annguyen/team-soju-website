const { createCatchEventsRepository } = require('../src/cloudflare/repositories/catch-events');

describe('Cloudflare catch events repository', () => {
  it('filters private events out of the public event list', async () => {
    const runCommand = jest.fn().mockResolvedValue({});
    const runOne = jest.fn();
    const runSelect = jest.fn()
      .mockResolvedValueOnce([
        { name: 'id' },
        { name: 'submissions_closed' },
        { name: 'is_private' },
        { name: 'auto_check_enabled' },
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
        { name: 'auto_check_enabled' },
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

  it('creates the D1 collaborator table before listing manageable events', async () => {
    const runCommand = jest.fn().mockResolvedValue({});
    const runOne = jest.fn();
    const runSelect = jest.fn()
      .mockResolvedValueOnce([
        { name: 'id' },
        { name: 'submissions_closed' },
        { name: 'is_private' },
        { name: 'auto_check_enabled' },
      ])
      .mockResolvedValueOnce([]);
    const repository = createCatchEventsRepository({
      dialect: 'd1',
      parameter: (index) => `?${index}`,
      runCommand,
      runOne,
      runSelect,
    });

    await repository.listEvents({ manageableByUserId: 'user-1' });

    expect(runCommand.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS catch_event_collaborators');
    expect(runSelect.mock.calls[1][0]).toContain('owner_user_id = ?1');
    expect(runSelect.mock.calls[1][0]).toContain('FROM catch_event_collaborators');
    expect(runSelect.mock.calls[1][0]).not.toContain('is_private = 0');
  });

  it('allows collaborators to update operational event controls', async () => {
    const runCommand = jest.fn().mockResolvedValue({});
    const runOne = jest.fn()
      .mockResolvedValueOnce({
        owner_user_id: 'owner-1',
        collaborator_user_id: 'user-1',
      })
      .mockResolvedValueOnce({
        id: 'event-1',
        owner_user_id: 'owner-1',
        owner_ign: 'Owner',
        name: 'Shared Event',
        slug: 'shared-event',
        event_date: '2026-05-20',
        start_local: '2026-05-20T10:00',
        end_local: '2026-05-20T11:00',
        timezone: 'America/Los_Angeles',
        region: 'Hoenn',
        route: 'Route 119',
        winner_count: 4,
        targets_json: '[]',
        species_bonuses_json: '[]',
        species_penalties_json: '[]',
        nature_bonuses_json: '[]',
        nature_penalties_json: '[]',
        use_lowest_score_final_place: 1,
        is_leaderboard_published: 0,
        is_private: 1,
        submissions_closed: 1,
        auto_check_enabled: 0,
        created_at: '2026-05-20T17:00:00Z',
      });
    const runSelect = jest.fn()
      .mockResolvedValueOnce([
        { name: 'id' },
        { name: 'submissions_closed' },
        { name: 'is_private' },
        { name: 'auto_check_enabled' },
      ])
      .mockResolvedValueOnce([]);
    const repository = createCatchEventsRepository({
      dialect: 'd1',
      parameter: (index) => `?${index}`,
      runCommand,
      runOne,
      runSelect,
    });

    const event = await repository.setSubmissionsClosed('event-1', 'user-1', true);

    expect(event.id).toBe('event-1');
    expect(runCommand.mock.calls.some((call) => call[0].includes('SET submissions_closed'))).toBe(true);
  });

  it('rejects operational event controls without owner or collaborator access', async () => {
    const runCommand = jest.fn().mockResolvedValue({});
    const runOne = jest.fn().mockResolvedValueOnce({
      owner_user_id: 'owner-1',
      collaborator_user_id: null,
    });
    const runSelect = jest.fn().mockResolvedValueOnce([
      { name: 'id' },
      { name: 'submissions_closed' },
      { name: 'is_private' },
      { name: 'auto_check_enabled' },
    ]);
    const repository = createCatchEventsRepository({
      dialect: 'd1',
      parameter: (index) => `?${index}`,
      runCommand,
      runOne,
      runSelect,
    });

    const event = await repository.setSubmissionsClosed('event-1', 'user-1', true);

    expect(event).toBeNull();
    expect(runCommand.mock.calls.some((call) => call[0].includes('SET submissions_closed'))).toBe(false);
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
        status: 'verified',
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
      .mockResolvedValueOnce([
        { sql: "CREATE TABLE catch_event_submissions (status TEXT CHECK (status IN ('pending-verification', 'auto-checked', 'needs-review', 'verified', 'rejected', 'disqualified')))" },
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
      status: 'pending-verification',
      flags: [],
    });

    expect(runSelect).toHaveBeenNthCalledWith(1, 'PRAGMA table_info(catch_event_submissions)');
    expect(runCommand.mock.calls[0][0]).toContain('ADD COLUMN region');
    expect(runCommand.mock.calls[1][0]).toContain('ADD COLUMN route');
    expect(runCommand.mock.calls[2][0]).toContain('INSERT INTO catch_event_submissions');
  });
});
