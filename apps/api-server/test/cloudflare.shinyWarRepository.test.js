const { createShinyWarRepository } = require('../src/cloudflare/repositories/shiny-war');
const { cleanQueue, participantLimitError, toPublicDashboard } = require('../src/cloudflare/routes/shiny-war');
const { groupEquivalentHuntSpots, locationAreaName, parentLocationName } = require('../src/cloudflare/repositories/hunt-spot-groups');

describe('Shiny War hunt spot grouping', () => {
  const makeSpot = (location, season, time) => ({
    spot_key: `${location}|${season}|${time}`,
    location,
    region: 'Hoenn',
    method: 'Sweet Scent',
    season,
    time,
    horde_size: 5,
    averagePoints: 30,
    pointsPerHour: 1.2,
    composition: [{ name: 'Trapinch', split: 1 }],
  });

  it('uses a floorless parent name for multi-floor locations', () => {
    expect(parentLocationName('Mirage Tower 1F')).toBe('Mirage Tower');
    expect(parentLocationName('Mirage Tower B2F')).toBe('Mirage Tower');
    expect(parentLocationName('Mirage Tower (3F)')).toBe('Mirage Tower');
    expect(locationAreaName('Mirage Tower (3F)')).toBe('3F');
    expect(parentLocationName('Route 119')).toBe('Route 119');
  });

  it('collapses equivalent floors and full-day splits without merging different splits', () => {
    const equivalent = ['morning', 'day', 'night'].flatMap((time) => [
      {
        ...makeSpot('Mirage Tower (1F)', 'Summer', time),
        composition: [{ name: 'Trapinch', split: 1, min_level: 20, max_level: 22 }],
      },
      {
        ...makeSpot('Mirage Tower (2F)', 'Summer', time),
        composition: [{ name: 'Trapinch', split: 1, min_level: 22, max_level: 24 }],
      },
    ]);
    const different = {
      ...makeSpot('Mirage Tower 3F', 'Summer', 'night'),
      composition: [{ name: 'Cacnea', split: 1 }],
    };

    const result = groupEquivalentHuntSpots([...equivalent, different]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ location: 'Mirage Tower', season: 'Summer', time: 'Any' });
    expect(result[0].spot_keys).toHaveLength(6);
    expect(result[0].location_areas).toEqual(['1F', '2F']);
    expect(result[1]).toMatchObject({ location: 'Mirage Tower', time: 'night' });
  });

  it('consolidates matching encounters across part of the day', () => {
    const result = groupEquivalentHuntSpots([
      makeSpot('Sky Pillar (1F)', 'Autumn', 'morning'),
      makeSpot('Sky Pillar (1F)', 'Autumn', 'day'),
      {
        ...makeSpot('Sky Pillar (1F)', 'Autumn', 'night'),
        composition: [{ name: 'Ariados', split: 1 }],
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ location: 'Sky Pillar', times: ['morning', 'day'] });
    expect(result[1]).toMatchObject({ time: 'night', times: ['night'] });
  });

  it('does not consolidate matching times from different floor sets', () => {
    const result = groupEquivalentHuntSpots([
      makeSpot('Sky Pillar (1F)', 'Autumn', 'morning'),
      makeSpot('Sky Pillar (3F)', 'Autumn', 'day'),
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((spot) => spot.location_areas)).toEqual([['1F'], ['3F']]);
  });
});

describe('Shiny War public dashboard', () => {
  it('exposes only public standings and catch fields', () => {
    const result = toPublicDashboard({
      event: { roster_locked: true },
      currentSeason: 'Summer',
      teamTotal: 38,
      teamTotals: { bidoof: 20, arceus: 18 },
      uniqueFamilyCount: 1,
      uniqueFamilies: ['vulpix'],
      standings: [{ member_id: 'member-1', discord_id: 'secret', ign: 'Hunter', team: 'bidoof', points: 38, catches: 1 }],
      recentCatches: [{
        id: 'shiny-1', original_trainer: 'member-1', pokemon: 'Vulpix', ign: 'Hunter',
        caught_at_utc: '2026-08-01T01:02:00.000Z', team: 'bidoof', war_eligibility_override: true,
        score: { base: 30, secretBonus: 0, safariBonus: 0, uniqueBonus: 8, total: 38 },
      }],
    });

    expect(result).toEqual({
      teamTotal: 38,
      teamTotals: { bidoof: 20, arceus: 18 },
      uniqueFamilyCount: 1,
      uniqueFamilies: ['vulpix'],
      standings: [{ ign: 'Hunter', team: 'bidoof', points: 38, catches: 1 }],
      recentCatches: [{
        pokemon: 'Vulpix', ign: 'Hunter', team: 'bidoof', caught_at_utc: '2026-08-01T01:02:00.000Z',
        score: { base: 30, secretBonus: 0, safariBonus: 0, uniqueBonus: 8, total: 38 },
      }],
    });
  });
});

describe('Shiny War roster limits', () => {
  const participant = (index, team, isOfficial) => ({
    member_id: `member-${index}`, team, is_official: isOfficial,
  });

  it('allows three non-official additions after each team reaches 15 official members', () => {
    const participants = [
      ...Array.from({ length: 15 }, (_, index) => participant(index, 'bidoof', true)),
      ...Array.from({ length: 15 }, (_, index) => participant(index + 15, 'arceus', true)),
      ...Array.from({ length: 2 }, (_, index) => participant(index + 30, 'bidoof', false)),
    ];

    expect(participantLimitError(participants, 'bidoof', false)).toBeNull();
    expect(participantLimitError(participants, 'bidoof', true))
      .toBe('The official roster is limited to 30 participants.');
  });

  it('caps each internal team at 18 participants', () => {
    const participants = Array.from(
      { length: 18 },
      (_, index) => participant(index, 'arceus', index < 15)
    );

    expect(participantLimitError(participants, 'arceus', false))
      .toBe('Each team-war roster is limited to 18 participants.');
  });
});

describe('Cloudflare Shiny Wars repository', () => {
  it('scores the official roster together and the internal teams independently', async () => {
    const participants = [
      { event_id: '2026', member_id: 'bidoof-official', ign: 'BidoofOne', rank: 'Member', team: 'bidoof', is_official: 1, has_app_user: 1 },
      { event_id: '2026', member_id: 'arceus-official', ign: 'ArceusOne', rank: 'Member', team: 'arceus', is_official: 1, has_app_user: 1 },
      { event_id: '2026', member_id: 'bidoof-extra', ign: 'BidoofExtra', rank: 'Member', team: 'bidoof', is_official: 0, has_app_user: 1 },
    ];
    const catches = participants.map((participant, index) => ({
      id: `shiny-${index}`,
      original_trainer: participant.member_id,
      ign: participant.ign,
      pokemon: 'Vulpix',
      family_key: 'vulpix',
      tier: 'Tier 3',
      tier_points: 30,
      caught_at_utc: `2026-08-01T0${index + 1}:00:00.000Z`,
      created_at: `2026-08-01T0${index + 1}:01:00.000Z`,
      status: 'Owned',
    }));
    const repository = createShinyWarRepository({
      dialect: 'd1',
      parameter: () => '?',
      runCommand: jest.fn(),
      runOne: jest.fn().mockResolvedValue({
        id: '2026', name: 'Shiny Wars', starts_at: '2026-08-01T00:00:00.000Z',
        ends_at: '2026-08-29T00:00:00.000Z', seasons_json: '["Summer"]', season_days: 28,
        roster_locked: 0,
      }),
      runSelect: jest.fn()
        .mockResolvedValueOnce(participants)
        .mockResolvedValueOnce(catches),
    });

    const dashboard = await repository.getDashboard('2026', new Date('2026-08-02T00:00:00.000Z'));

    expect(dashboard.teamTotal).toBe(68);
    expect(dashboard.teamTotals).toEqual({ bidoof: 68, arceus: 38 });
    expect(dashboard.standings.find((entry) => entry.member_id === 'arceus-official').points).toBe(38);
    expect(dashboard.standings.find((entry) => entry.member_id === 'bidoof-extra').is_official).toBe(false);
    expect(dashboard.recentCatches.find((entry) => entry.member_id === 'bidoof-extra'))
      .toMatchObject({ team: 'bidoof', is_official: false });
  });

  it('normalizes raw 5% horde tables into the Mansion split', async () => {
    const repository = createShinyWarRepository({
      dialect: 'd1',
      parameter: () => '?',
      runCommand: jest.fn(),
      runOne: jest.fn(),
      runSelect: jest.fn().mockResolvedValue([
        {
          location_id: '1:77', location_name: 'Pokemon Mansion 2F', region: 'Kanto',
          method: 'Sweet Scent', season: 'Summer', horde_size: 5,
          species_name: 'Vulpix', slug: 'vulpix', family_key: 'vulpix',
          tier: 'Tier 3', points: 30, form: '', min_level: 28, max_level: 30,
          morning_rate: 0, day_rate: 0, night_rate: 2.5,
        },
        {
          location_id: '1:77', location_name: 'Pokemon Mansion 2F', region: 'Kanto',
          method: 'Sweet Scent', season: 'Summer', horde_size: 5,
          species_name: 'Grimer', slug: 'grimer', family_key: 'grimer',
          tier: 'Tier 6', points: 5, form: '', min_level: 28, max_level: 30,
          morning_rate: 0, day_rate: 0, night_rate: 2.5,
        },
      ]),
    });

    const result = await repository.listHordeSpots({
      season: 'Summer',
      time: 'night',
      hordesPerHour: 240,
      profile: { eventBoost: false },
    });

    expect(result.total).toBe(1);
    expect(result.items[0].composition.map((entry) => entry.split)).toEqual([0.5, 0.5]);
    expect(result.items[0].averagePoints).toBe(17.5);
    expect(result.items[0].pointsPerHour).toBe(0.7);
  });

  it('keeps Zorua in Sweet Scent compositions without labeling it as lure-only', async () => {
    const repository = createShinyWarRepository({
      dialect: 'd1',
      parameter: () => '?',
      runCommand: jest.fn(),
      runOne: jest.fn(),
      runSelect: jest.fn().mockResolvedValue([
        {
          location_id: '4:1', location_name: 'Lostlorn Forest', region: 'Unova',
          method: 'Sweet Scent', season: 'Summer', horde_size: 3, is_lure: 0,
          species_name: 'Heracross', slug: 'heracross', family_key: 'heracross',
          tier: 'Tier 3', points: 30, form: '', min_level: 20, max_level: 21,
          morning_rate: 2, day_rate: 2, night_rate: 2,
        },
        {
          location_id: '4:1', location_name: 'Lostlorn Forest', region: 'Unova',
          method: 'Sweet Scent', season: 'Summer', horde_size: 3, is_lure: 1,
          species_name: 'Zorua', slug: 'zorua', family_key: 'zorua',
          tier: 'Tier 2', points: 40, form: '', min_level: 20, max_level: 21,
          morning_rate: null, day_rate: null, night_rate: null,
        },
      ]),
    });

    const result = await repository.listHordeSpots({
      season: 'Summer', time: 'day', profile: { eventBoost: false },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].is_lure).toBe(false);
    expect(result.items[0].composition).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Zorua', is_lure: false, rate_unknown: true, split: 0,
      }),
    ]));
  });

  it('filters horde locations by species without changing their composition', async () => {
    const runSelect = jest.fn().mockResolvedValue([
      {
        location_id: '1:77', location_name: 'Pokemon Mansion 2F', region: 'Kanto',
        method: 'Sweet Scent', season: 'Summer', horde_size: 5,
        species_name: 'Vulpix', slug: 'vulpix', family_key: 'vulpix',
        tier: 'Tier 3', points: 30, form: '', min_level: 28, max_level: 30,
        morning_rate: 0, day_rate: 0, night_rate: 2.5,
      },
      {
        location_id: '1:77', location_name: 'Pokemon Mansion 2F', region: 'Kanto',
        method: 'Sweet Scent', season: 'Summer', horde_size: 5,
        species_name: 'Grimer', slug: 'grimer', family_key: 'grimer',
        tier: 'Tier 6', points: 5, form: '', min_level: 28, max_level: 30,
        morning_rate: 0, day_rate: 0, night_rate: 2.5,
      },
      {
        location_id: '1:1', location_name: 'Viridian Forest', region: 'Kanto',
        method: 'Sweet Scent', season: 'Summer', horde_size: 5,
        species_name: 'Pikachu', slug: 'pikachu', family_key: 'pikachu',
        tier: 'Tier 4', points: 15, form: '', min_level: 3, max_level: 5,
        morning_rate: 5, day_rate: 5, night_rate: 5,
      },
    ]);
    const repository = createShinyWarRepository({
      dialect: 'd1',
      parameter: () => '?',
      runCommand: jest.fn(),
      runOne: jest.fn(),
      runSelect,
    });

    const result = await repository.listHordeSpots({
      season: 'Summer',
      species: 'vulpix',
      time: 'night',
      profile: { eventBoost: false },
    });

    expect(result.total).toBe(1);
    expect(result.items[0].location).toBe('Pokemon Mansion');
    expect(result.items[0].composition.map(({ name, split }) => [name, split])).toEqual([
      ['Vulpix', 0.5],
      ['Grimer', 0.5],
    ]);
    expect(runSelect.mock.calls[0][0]).not.toContain('LOWER(s.name) LIKE');
  });

  it('filters horde locations to 100% species splits', async () => {
    const repository = createShinyWarRepository({
      dialect: 'd1',
      parameter: () => '?',
      runCommand: jest.fn(),
      runOne: jest.fn(),
      runSelect: jest.fn().mockResolvedValue([
        {
          location_id: '1:77', location_name: 'Pokemon Mansion 2F', region: 'Kanto',
          method: 'Sweet Scent', season: 'Summer', horde_size: 5,
          species_name: 'Vulpix', slug: 'vulpix', family_key: 'vulpix',
          tier: 'Tier 3', points: 30, form: '', min_level: 28, max_level: 30,
          morning_rate: 0, day_rate: 0, night_rate: 2.5,
        },
        {
          location_id: '1:77', location_name: 'Pokemon Mansion 2F', region: 'Kanto',
          method: 'Sweet Scent', season: 'Summer', horde_size: 5,
          species_name: 'Grimer', slug: 'grimer', family_key: 'grimer',
          tier: 'Tier 6', points: 5, form: '', min_level: 28, max_level: 30,
          morning_rate: 0, day_rate: 0, night_rate: 2.5,
        },
        {
          location_id: '1:1', location_name: 'Viridian Forest', region: 'Kanto',
          method: 'Sweet Scent', season: 'Summer', horde_size: 5,
          species_name: 'Pikachu', slug: 'pikachu', family_key: 'pikachu',
          tier: 'Tier 4', points: 15, form: '', min_level: 3, max_level: 5,
          morning_rate: 0, day_rate: 0, night_rate: 5,
        },
      ]),
    });

    const result = await repository.listHordeSpots({
      season: 'Summer',
      time: 'night',
      fullSplitOnly: true,
      profile: { eventBoost: false },
    });

    expect(result.total).toBe(1);
    expect(result.items[0].location).toBe('Viridian Forest');
    expect(result.items[0].composition[0].split).toBe(1);
  });

  it('filters by location and returns location combobox options before that filter', async () => {
    const repository = createShinyWarRepository({
      dialect: 'd1',
      parameter: () => '?',
      runCommand: jest.fn(),
      runOne: jest.fn(),
      runSelect: jest.fn().mockResolvedValue([
        {
          location_id: '1:77', location_name: 'Pokemon Mansion 2F', region: 'Kanto',
          method: 'Sweet Scent', season: 'Summer', horde_size: 5,
          species_name: 'Vulpix', slug: 'vulpix', family_key: 'vulpix',
          tier: 'Tier 3', points: 30, form: '', min_level: 28, max_level: 30,
          morning_rate: 5, day_rate: 5, night_rate: 5,
        },
        {
          location_id: '1:1', location_name: 'Viridian Forest', region: 'Kanto',
          method: 'Sweet Scent', season: 'Summer', horde_size: 5,
          species_name: 'Pikachu', slug: 'pikachu', family_key: 'pikachu',
          tier: 'Tier 4', points: 15, form: '', min_level: 3, max_level: 5,
          morning_rate: 5, day_rate: 5, night_rate: 5,
        },
      ]),
    });

    const result = await repository.listHordeSpots({
      season: 'Summer',
      time: 'day',
      location: 'mansion',
      profile: { eventBoost: false },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].location).toBe('Pokemon Mansion');
    expect(result.locations).toEqual(['Pokemon Mansion', 'Viridian Forest']);
  });

  it('groups single encounters, marks lure species, and filters by minimum points per hour', async () => {
    const runSelect = jest.fn().mockResolvedValue([
      {
        location_id: '0:1', location_name: 'Route 1', region: 'Kanto',
        method: 'Grass', season: 'Summer', horde_size: 0, is_lure: 1,
        species_name: 'Bulbasaur', slug: 'bulbasaur', family_key: 'bulbasaur',
        tier: 'Tier 3', points: 30, form: '', min_level: 10, max_level: 10,
        morning_rate: 5, day_rate: 5, night_rate: 5,
      },
      {
        location_id: '0:2', location_name: 'Route 2', region: 'Kanto',
        method: 'Grass', season: 'Summer', horde_size: 0, is_lure: 0,
        species_name: 'Rattata', slug: 'rattata', family_key: 'rattata',
        tier: 'Tier 7', points: 3, form: '', min_level: 2, max_level: 3,
        morning_rate: 100, day_rate: 100, night_rate: 100,
      },
    ]);
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(), runSelect,
    });

    const result = await repository.listHordeSpots({
      method: 'Singles', time: 'day', minPointsPerHour: 0.1,
      hordeSize: 5, fullSplitOnly: true, profile: { eventBoost: false },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ location: 'Route 1', horde_size: 0, is_lure: true });
    expect(result.items[0].composition[0]).toMatchObject({ name: 'Bulbasaur', is_lure: true });
    expect(result.items[0].encountersPerHour).toBe(300);
    expect(runSelect.mock.calls[0][0]).toContain('e.horde_size = 0');
    expect(runSelect.mock.calls[0][1]).not.toContain(5);
  });

  it('includes legacy Any-season Lure encounters such as Togetic in every season', async () => {
    const runSelect = jest.fn().mockResolvedValue([
      {
        location_id: '0:509', location_name: 'Five Isle Meadow', region: 'Kanto',
        method: 'Grass', season: 'Any', horde_size: 0,
        species_name: 'Togetic', slug: 'togetic', family_key: 'togepi',
        tier: 'Tier 2', points: 40, form: '', min_level: 56, max_level: 56,
        morning_rate: null, day_rate: null, night_rate: null,
      },
      {
        location_id: '0:509', location_name: 'Five Isle Meadow', region: 'Kanto',
        method: 'Grass', season: 'Summer', horde_size: 0, is_lure: 0,
        species_name: 'Pidgey', slug: 'pidgey', family_key: 'pidgey',
        tier: 'Tier 7', points: 3, form: '', min_level: 48, max_level: 50,
        morning_rate: 100, day_rate: 100, night_rate: 100,
      },
    ]);
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(), runSelect,
    });

    const result = await repository.listHordeSpots({
      method: 'Singles', season: 'Summer', species: 'Togetic', time: 'day',
      profile: { eventBoost: false },
    });

    expect(runSelect.mock.calls[0][0]).toContain("OR e.season = 'Any'");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      location: 'Five Isle Meadow', season: 'Summer', is_lure: true,
    });
    expect(result.items[0].composition).toHaveLength(2);
    const togetic = result.items[0].composition.find((entry) => entry.name === 'Togetic');
    expect(togetic).toMatchObject({ is_lure: true });
    expect(togetic.split).toBeCloseTo(5 / 105);
  });

  it('collapses equivalent Any-season encounters into one Any-season group', async () => {
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(),
      runSelect: jest.fn().mockResolvedValue([{
        location_id: '0:509', location_name: 'Five Isle Meadow', region: 'Kanto',
        method: 'Grass', season: 'Any', horde_size: 0, is_lure: 1,
        species_name: 'Togetic', slug: 'togetic', family_key: 'togepi',
        tier: 'Tier 2', points: 40, form: '', min_level: 56, max_level: 56,
        morning_rate: 5, day_rate: 5, night_rate: 5,
      }]),
    });

    const result = await repository.listHordeSpots({ method: 'Singles', time: 'day' });

    expect(result.items.map((spot) => spot.season)).toEqual(['Any']);
  });

  it('categorizes Rocks as Rock Smash instead of Singles', async () => {
    const runSelect = jest.fn().mockResolvedValue([]);
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(), runSelect,
    });

    await repository.listHordeSpots({ method: 'Singles' });
    expect(runSelect.mock.calls[0][1]).not.toContain('Rocks');

    await repository.listHordeSpots({ method: 'Rock Smash' });
    expect(runSelect.mock.calls[1][1]).toEqual(expect.arrayContaining(['Rock Smash', 'Rocks']));
  });

  it.each(['Singles', 'Fishing'])('can exclude Safari encounters from %s', async (method) => {
    const runSelect = jest.fn().mockResolvedValue([]);
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(), runSelect,
    });

    await repository.listHordeSpots({ method, nonSafari: true });

    expect(runSelect.mock.calls[0][0]).toContain("LOWER(l.name) NOT LIKE '%safari%'");
    expect(runSelect.mock.calls[0][0]).toContain("LOWER(l.name) NOT LIKE '%great marsh%'");
  });

  it('ignores the non-Safari filter for other encounter methods', async () => {
    const runSelect = jest.fn().mockResolvedValue([]);
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(), runSelect,
    });

    await repository.listHordeSpots({ method: 'Sweet Scent', nonSafari: true });

    expect(runSelect.mock.calls[0][0]).not.toContain("LOWER(l.name) NOT LIKE");
  });

  it.each([
    ['Singles', 'Grass', 300],
    ['Singles', 'Dark Grass', 400],
    ['Fishing', 'Super Rod', 200],
    ['Honey Trees', 'Honey Tree', 50],
    ['Headbutt', 'Headbutt', null],
    ['Rock Smash', 'Rocks', null],
  ])('uses the configured %s hourly rate for %s', async (filterMethod, rowMethod, expectedRate) => {
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(),
      runSelect: jest.fn().mockResolvedValue([{
        location_id: '0:1', location_name: 'Test Route', region: 'Kanto',
        method: rowMethod, season: 'Summer', horde_size: 0, is_lure: 0,
        species_name: 'Vulpix', slug: 'vulpix', family_key: 'vulpix',
        tier: 'Tier 3', points: 30, form: '', min_level: 10, max_level: 10,
        morning_rate: 100, day_rate: 100, night_rate: 100,
      }]),
    });

    const result = await repository.listHordeSpots({
      method: filterMethod, time: 'day', profile: { eventBoost: false },
    });

    expect(result.items[0].encountersPerHour).toBe(expectedRate);
    expect(result.items[0].pointsPerHour).toBe(
      expectedRate === null ? null : (30 * expectedRate) / 30000
    );
  });

  it('increases Fishing to 400 encounters per hour with a Chum bucket', async () => {
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(),
      runSelect: jest.fn().mockResolvedValue([{
        location_id: '0:1', location_name: 'Test Pond', region: 'Kanto',
        method: 'Super Rod', season: 'Summer', horde_size: 0, is_lure: 0,
        species_name: 'Goldeen', slug: 'goldeen', family_key: 'goldeen',
        tier: 'Tier 7', points: 3, form: '', min_level: 10, max_level: 10,
        morning_rate: 100, day_rate: 100, night_rate: 100,
      }]),
    });

    const result = await repository.listHordeSpots({
      method: 'Fishing', time: 'day', chumBucket: true, profile: { eventBoost: false },
    });

    expect(result.items[0].encountersPerHour).toBe(400);
    expect(result.items[0].pointsPerHour).toBe(0.04);
  });

  it('sorts Rock Smash locations by average point potential', async () => {
    const baseRow = {
      region: 'Kanto', method: 'Rocks', season: 'Summer', horde_size: 0, is_lure: 0,
      form: '', min_level: 10, max_level: 10, morning_rate: 100, day_rate: 100, night_rate: 100,
    };
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(),
      runSelect: jest.fn().mockResolvedValue([
        { ...baseRow, location_id: '0:1', location_name: 'Low Point Cave', species_name: 'Rattata', slug: 'rattata', family_key: 'rattata', tier: 'Tier 7', points: 3 },
        { ...baseRow, location_id: '0:2', location_name: 'High Point Cave', species_name: 'Vulpix', slug: 'vulpix', family_key: 'vulpix', tier: 'Tier 3', points: 30 },
      ]),
    });

    const result = await repository.listHordeSpots({ method: 'Rock Smash', time: 'day' });

    expect(result.items.map((spot) => spot.location)).toEqual(['High Point Cave', 'Low Point Cave']);
  });

  it('rejects malformed or oversized queues at the route boundary', () => {
    expect(cleanQueue([{ spot_key: 'spot', label: 'Mansion', details: {} }])).toHaveLength(1);
    expect(cleanQueue([{ spot_key: '', label: 'Missing spot' }])).toBeNull();
    expect(cleanQueue(Array.from({ length: 21 }, (_, index) => ({
      spot_key: `spot-${index}`, label: `Spot ${index}`,
    })))).toBeNull();
  });
});
