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
    });

    expect(sql).toContain('PRAGMA foreign_keys = OFF;');
    expect(sql).toContain("INSERT INTO team_members");
    expect(sql).toContain("member''s note");
    expect(sql).toContain("INSERT INTO team_shinies");
    expect(sql).toContain("'Owned'");
    expect(sql).toContain('PRAGMA foreign_keys = ON;');
  });
});
