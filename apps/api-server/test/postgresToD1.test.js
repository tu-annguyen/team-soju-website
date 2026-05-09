const { convertPostgresExportToD1Sql } = require('../src/scripts/postgresToD1');

describe('convertPostgresExportToD1Sql', () => {
  it('serializes members and shinies into D1-compatible insert statements', () => {
    const sql = convertPostgresExportToD1Sql({
      members: [{
        id: 'member-1',
        ign: 'MemberOne',
        discord_id: '123',
        rank: 'Trainer',
        notes: "member's note",
        join_date: '2026-04-06',
        is_active: true,
      }],
      shinies: [{
        id: 'shiny-1',
        pokemon: 'pikachu',
        variants: 'pikachu',
        national_number: 25,
        original_trainer: 'member-1',
        catch_date: '2026-04-06',
        total_encounters: 99,
        species_encounters: 99,
        encounter_type: 'single',
        location: 'Route 1',
        nature: 'Jolly',
        iv_hp: 31,
        iv_attack: 31,
        iv_defense: 31,
        iv_sp_attack: 31,
        iv_sp_defense: 31,
        iv_speed: 31,
        is_secret: false,
        is_alpha: true,
        screenshot_url: null,
        status: 'Owned',
        notes: null,
        created_at: '2026-04-06T01:02:03.000Z',
      }],
      users: [{
        id: 'user-1',
        email: 'trainer@example.com',
        password_hash: 'hash',
        ign: 'Trainer',
        discord_id: 'discord-1',
        discord_username: 'trainer',
        discord_global_name: 'Trainer Global',
        discord_avatar: 'avatar',
        auth_provider: 'password_discord',
        created_at: '2026-04-06T01:02:03.000Z',
        updated_at: '2026-04-06T01:02:03.000Z',
        last_login_at: null,
      }],
      feebasCycles: [{
        id: 1,
        location: 'route-119-main',
        cycle_start: '2026-04-09T20:15:00.000Z',
        cycle_end: '2026-04-09T21:00:00.000Z',
        confirmed_tile_id: null,
        locked_at: null,
        created_at: '2026-04-09T20:15:00.000Z',
      }],
      feebasTileVotes: [{
        id: 2,
        cycle_id: 1,
        tile_id: 'r1c7',
        actor_fingerprint: 'account-user-1',
        actor_name: 'Trainer',
        status: 'pending',
        created_at: '2026-04-09T20:16:00.000Z',
        updated_at: '2026-04-09T20:16:00.000Z',
      }],
      feebasActivityLogs: [{
        id: 3,
        cycle_id: 1,
        location: 'route-119-main',
        tile_id: 'r1c7',
        tile_label: 'G15',
        action_type: 'voted',
        previous_status: null,
        next_status: 'pending',
        actor_name: 'Trainer',
        actor_fingerprint: 'account-user-1',
        created_at: '2026-04-09T20:16:00.000Z',
      }],
      feebasConfirmedTileSnapshots: [{
        id: 4,
        location: 'route-119-main',
        source_cycle_id: 1,
        cycle_start: '2026-04-09T20:15:00.000Z',
        cycle_end: '2026-04-09T21:00:00.000Z',
        tile_id: 'r1c7',
        tile_label: 'G15',
        confirmed_vote_count: 2,
        archived_at: '2026-04-09T21:00:00.000Z',
      }],
    });

    expect(sql).toContain('PRAGMA foreign_keys = OFF;');
    expect(sql).toContain("INSERT INTO team_members");
    expect(sql).toContain("member''s note");
    expect(sql).toContain("INSERT INTO team_shinies");
    expect(sql).toContain("'Owned'");
    expect(sql).toContain("INSERT INTO app_users");
    expect(sql).toContain("'password_discord'");
    expect(sql).toContain("INSERT INTO feebas_cycles");
    expect(sql).toContain("INSERT INTO feebas_tile_votes");
    expect(sql).toContain("INSERT INTO feebas_activity_logs");
    expect(sql).toContain("INSERT INTO feebas_confirmed_tile_snapshots");
    expect(sql).toContain('PRAGMA foreign_keys = ON;');
  });
});
