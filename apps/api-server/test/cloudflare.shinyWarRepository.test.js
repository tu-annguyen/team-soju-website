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
      familySpecies: { vulpix: ['Vulpix', 'Ninetales'] },
      officialWar: {
        teamTotal: 38, uniqueFamilyCount: 1, uniqueFamilies: ['vulpix'],
        standings: [{
          member_id: 'member-1', discord_id: 'secret', ign: 'Hunter', team: 'bidoof',
          points: 38, basePoints: 30, bonusPoints: 8, catches: 1,
        }],
        recentCatches: [{
          id: 'shiny-1', original_trainer: 'member-1', pokemon: 'Vulpix', ign: 'Hunter',
          caught_at_utc: '2026-08-01T01:02:00.000Z', team: 'bidoof', war_eligibility_override: true,
          score: { base: 30, secretBonus: 0, safariBonus: 0, uniqueBonus: 8, total: 38 },
        }],
      },
      teamWar: {
        teamTotals: { bidoof: 38, arceus: 0 },
        uniqueFamilies: { bidoof: ['vulpix'], arceus: [] },
        standings: [], recentCatches: [],
      },
    });

    expect(result).toEqual({
      familySpecies: { vulpix: ['Vulpix', 'Ninetales'] },
      officialWar: {
        teamTotal: 38, uniqueFamilyCount: 1, uniqueFamilies: ['vulpix'],
        standings: [{
          ign: 'Hunter', team: 'bidoof', points: 38, basePoints: 30, bonusPoints: 8, catches: 1,
        }],
        recentCatches: [{
          pokemon: 'Vulpix', ign: 'Hunter', team: 'bidoof', caught_at_utc: '2026-08-01T01:02:00.000Z',
          score: { base: 30, secretBonus: 0, safariBonus: 0, uniqueBonus: 8, total: 38 },
        }],
      },
      teamWar: {
        teamTotals: { bidoof: 38, arceus: 0 },
        uniqueFamilies: { bidoof: ['vulpix'], arceus: [] },
        standings: [], recentCatches: [],
      },
    });
  });
});

describe('Shiny War roster limits', () => {
  const participant = (index, team, isOfficial) => ({
    member_id: `member-${index}`, team, is_official: isOfficial,
  });

  it('allows unlimited non-official participants on either internal team', () => {
    const participants = [
      ...Array.from({ length: 15 }, (_, index) => participant(index, 'bidoof', true)),
      ...Array.from({ length: 15 }, (_, index) => participant(index + 15, 'arceus', true)),
      ...Array.from({ length: 100 }, (_, index) => participant(index + 30, 'bidoof', false)),
    ];

    expect(participantLimitError(participants, false)).toBeNull();
    expect(participantLimitError(participants, true))
      .toBe('The official roster is limited to 30 participants.');
  });

  it('allows all 30 official participants to be assigned to one internal team', () => {
    const participants = Array.from({ length: 29 }, (_, index) => participant(index, 'arceus', true));

    expect(participantLimitError(participants, true)).toBeNull();
    expect(participantLimitError([...participants, participant(29, 'arceus', true)], true))
      .toBe('The official roster is limited to 30 participants.');
  });
});

describe('Cloudflare Shiny Wars repository', () => {
  it('keeps complete compositions only for splits that meet the minimum tier', async () => {
    const rows = [
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
        location_id: '1:77', location_name: 'Pokemon Mansion 2F', region: 'Kanto',
        method: 'Sweet Scent', season: 'Summer', horde_size: 3,
        species_name: 'Pikachu', slug: 'pikachu', family_key: 'pichu',
        tier: 'Tier 4', points: 15, form: '', min_level: 3, max_level: 5,
        morning_rate: 0, day_rate: 0, night_rate: 3,
      },
    ];
    const runSelect = jest.fn().mockResolvedValue(rows);
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(), runSelect,
    });

    const result = await repository.listHordeSpots({
      season: 'Summer', time: 'night', minTier: '3', profile: { eventBoost: false },
    });

    expect(runSelect.mock.calls[0][0]).not.toContain('CASE s.tier');
    expect(result.total).toBe(1);
    expect(result.items[0].location).toBe('Pokemon Mansion');
    expect(result.items[0].composition.map((species) => species.name)).toEqual(['Vulpix', 'Grimer']);
    expect(result.items[0].composition.map((species) => species.split)).toEqual([0.5, 0.5]);
  });

  it('requires every species to meet minimum level and OR-matches EV yields', async () => {
    const base = {
      region: 'Kanto', method: 'Sweet Scent', season: 'Summer', horde_size: 5,
      tier: 'Tier 5', points: 10, form: '', morning_rate: 5, day_rate: 5, night_rate: 5,
      base_exp: 70, ev_hp: 0, ev_attack: 0, ev_defense: 0,
      ev_sp_attack: 0, ev_sp_defense: 0, ev_speed: 0,
    };
    const rows = [
      { ...base, location_id: '1:1', location_name: 'Route 1', species_name: 'Rattata', slug: 'rattata', family_key: 'rattata', min_level: 30, max_level: 32, ev_speed: 2 },
      { ...base, location_id: '1:1', location_name: 'Route 1', species_name: 'Pidgey', slug: 'pidgey', family_key: 'pidgey', min_level: 29, max_level: 31, ev_speed: 1 },
      { ...base, location_id: '1:2', location_name: 'Route 2', species_name: 'Spearow', slug: 'spearow', family_key: 'spearow', min_level: 30, max_level: 32, ev_attack: 1 },
    ];
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(),
      runSelect: jest.fn().mockResolvedValue(rows),
    });

    const result = await repository.listHordeSpots({
      season: 'Summer', time: 'day', minLevel: 30,
      evStats: ['speed', 'attack'], evAmounts: ['1'], profile: { eventBoost: false },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].location).toBe('Route 2');
    expect(result.items[0].expPerHour).toBeGreaterThan(0);

    const aboveMaximum = await repository.listHordeSpots({
      season: 'Summer', time: 'day', minExpPerHour: 1_000_000_000,
      profile: { eventBoost: false },
    });
    expect(aboveMaximum.items).toHaveLength(0);
  });

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
        .mockResolvedValueOnce(catches)
        .mockResolvedValueOnce([
          { name: 'Vulpix', family_key: 'vulpix' },
          { name: 'Ninetales', family_key: 'vulpix' },
        ]),
    });

    const dashboard = await repository.getDashboard('2026', new Date('2026-08-02T00:00:00.000Z'));

    expect(dashboard.officialWar.teamTotal).toBe(68);
    expect(dashboard.familySpecies).toEqual({ vulpix: ['Vulpix', 'Ninetales'] });
    expect(dashboard.teamWar.teamTotals).toEqual({ bidoof: 68, arceus: 38 });
    expect(dashboard.officialWar.standings).toHaveLength(2);
    expect(dashboard.officialWar.standings.find((entry) => entry.member_id === 'bidoof-official'))
      .toMatchObject({ points: 38, basePoints: 30, bonusPoints: 8 });
    expect(dashboard.officialWar.standings.find((entry) => entry.member_id === 'arceus-official'))
      .toMatchObject({ points: 30, basePoints: 30, bonusPoints: 0 });
    expect(dashboard.teamWar.standings.find((entry) => entry.member_id === 'arceus-official').caughtFamilyKeys)
      .toEqual(['vulpix']);
    expect(dashboard.teamWar.standings.find((entry) => entry.member_id === 'bidoof-extra').is_official).toBe(false);
    expect(dashboard.officialWar.recentCatches.find((entry) => entry.member_id === 'bidoof-extra')).toBeUndefined();
    expect(dashboard.teamWar.recentCatches.find((entry) => entry.member_id === 'bidoof-extra'))
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

  it('adds the unique-family bonus to expected points and excludes official-caught lines', async () => {
    const rows = [
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
        species_name: 'Pikachu', slug: 'pikachu', family_key: 'pichu',
        tier: 'Tier 4', points: 15, form: '', min_level: 3, max_level: 5,
        morning_rate: 0, day_rate: 0, night_rate: 5,
      },
    ];
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(),
      runSelect: jest.fn().mockResolvedValue(rows),
    });

    const scored = await repository.listHordeSpots({
      season: 'Summer', time: 'night', hordesPerHour: 240,
      officialUniqueBonus: true,
      officialCaughtFamilyKeys: ['vulpix'],
      profile: { eventBoost: false },
    });
    const mansion = scored.items.find((spot) => spot.location === 'Pokemon Mansion');
    expect(mansion.averagePoints).toBe(21.5);
    expect(mansion.pointsPerHour).toBe(0.86);
    expect(mansion.composition.find((species) => species.name === 'Grimer').points).toBe(5);

    const filtered = await repository.listHordeSpots({
      season: 'Summer', time: 'night', excludeOfficialCaught: true,
      officialCaughtFamilyKeys: ['vulpix', 'pichu'],
      profile: { eventBoost: false },
    });
    expect(filtered.items).toHaveLength(0);

    const teamFiltered = await repository.listHordeSpots({
      season: 'Summer', time: 'night', excludeTeamCaught: true,
      officialCaughtFamilyKeys: ['pichu'],
      teamCaughtFamilyKeys: ['vulpix'],
      profile: { eventBoost: false },
    });
    expect(teamFiltered.items).toHaveLength(1);
    expect(teamFiltered.items[0].location).toBe('Viridian Forest');
  });

  it('calculates the logged-in player\'s duplicate species as one point', async () => {
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(),
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
      season: 'Summer', time: 'night', hordesPerHour: 240,
      playerCaughtFamilyKeys: ['vulpix'],
      profile: { eventBoost: false },
    });

    expect(result.items[0].composition.find((entry) => entry.name === 'Vulpix').points).toBe(1);
    expect(result.items[0].averagePoints).toBe(3);
    expect(result.items[0].pointsPerHour).toBe(0.12);
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
      method: 'All',
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

  it('labels Special encounters and excludes them from points-per-hour calculations', async () => {
    const runSelect = jest.fn().mockResolvedValue([
      {
        location_id: '4:1', location_name: 'Guidance Chamber', region: 'Unova',
        method: 'Dust Cloud', season: 'Any', horde_size: 0, is_lure: 0, is_special: 0,
        species_name: 'Drilbur', slug: 'drilbur', family_key: 'drilbur',
        tier: 'Tier 1', points: 45, form: '', min_level: 36, max_level: 41,
        morning_rate: null, day_rate: null, night_rate: null,
      },
      {
        location_id: '4:1', location_name: 'Guidance Chamber', region: 'Unova',
        method: 'Dust Cloud', season: 'Any', horde_size: 0, is_lure: 0, is_special: 0,
        species_name: 'Boldore', slug: 'boldore', family_key: 'roggenrola',
        tier: 'Tier 7', points: 3, form: '', min_level: 36, max_level: 41,
        morning_rate: 100, day_rate: 100, night_rate: 100,
      },
    ]);
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(), runSelect,
    });

    const result = await repository.listHordeSpots({
      method: 'Singles', season: 'Summer', time: 'day', profile: { eventBoost: false },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ is_lure: false, is_special: true });
    expect(result.items[0].pointsPerHour).toBeCloseTo(0.03);
    expect(result.items[0].composition).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Drilbur', is_lure: false, is_special: true, split: 0 }),
      expect.objectContaining({ name: 'Boldore', is_special: false, split: 1 }),
    ]));
  });

  it('separates legacy rustling-grass Special encounters from real Unova lures', async () => {
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(),
      runSelect: jest.fn().mockResolvedValue([
        {
          location_id: '4:2', location_name: 'Lostlorn Forest', region: 'Unova',
          method: 'Grass', season: 'Summer', horde_size: 0, is_lure: 0, is_special: 0,
          species_name: 'Emolga', slug: 'emolga', family_key: 'emolga',
          tier: 'Tier 1', points: 45, form: '', min_level: 24, max_level: 26,
          morning_rate: null, day_rate: null, night_rate: null,
        },
        {
          location_id: '4:2', location_name: 'Lostlorn Forest', region: 'Unova',
          method: 'Grass', season: 'Any', horde_size: 0, is_lure: 1, is_special: 0,
          species_name: 'Servine', slug: 'servine', family_key: 'snivy',
          tier: 'Tier 0', points: 50, form: '', min_level: 27, max_level: 27,
          morning_rate: 5, day_rate: 5, night_rate: 5,
        },
        {
          location_id: '4:2', location_name: 'Lostlorn Forest', region: 'Unova',
          method: 'Grass', season: 'Summer', horde_size: 0, is_lure: 0, is_special: 0,
          species_name: 'Cottonee', slug: 'cottonee', family_key: 'cottonee',
          tier: 'Tier 5', points: 10, form: '', min_level: 22, max_level: 24,
          morning_rate: 10, day_rate: 10, night_rate: 10,
        },
      ]),
    });

    const result = await repository.listHordeSpots({
      method: 'Singles', season: 'Summer', time: 'day', profile: { eventBoost: false },
    });
    const emolga = result.items[0].composition.find((entry) => entry.name === 'Emolga');
    const servine = result.items[0].composition.find((entry) => entry.name === 'Servine');

    expect(result.items[0]).toMatchObject({ is_special: true, is_lure: true });
    expect(emolga).toMatchObject({ is_special: true, is_lure: false, split: 0 });
    expect(servine).toMatchObject({ is_special: false, is_lure: true });
  });

  it('recognizes legacy Feebas rows as Special without a migrated flag', async () => {
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(),
      runSelect: jest.fn().mockResolvedValue([{
        location_id: '1:1', location_name: 'Route 119', region: 'Hoenn',
        method: 'Super Rod', season: 'Any', horde_size: 0, is_lure: 1, is_special: 0,
        species_name: 'Feebas', slug: 'feebas', family_key: 'feebas',
        tier: 'Tier 2', points: 40, form: '', min_level: 20, max_level: 25,
        morning_rate: 5, day_rate: 5, night_rate: 5,
      }]),
    });

    const result = await repository.listHordeSpots({ method: 'Fishing', time: 'day' });

    expect(result.items[0]).toMatchObject({ is_special: true, is_lure: false, pointsPerHour: 0 });
    expect(result.items[0].composition[0]).toMatchObject({
      name: 'Feebas', is_special: true, is_lure: false, split: 0,
    });
  });

  it('keeps a useful average for Special-only spots while reporting zero points per hour', async () => {
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(),
      runSelect: jest.fn().mockResolvedValue([
        {
          location_id: '4:1', location_name: 'Guidance Chamber', region: 'Unova',
          method: 'Dust Cloud', season: 'Any', horde_size: 0, is_lure: 0, is_special: 1,
          species_name: 'Drilbur', slug: 'drilbur', family_key: 'drilbur',
          tier: 'Tier 1', points: 45, form: '', min_level: 36, max_level: 41,
          morning_rate: null, day_rate: null, night_rate: null,
        },
        {
          location_id: '4:1', location_name: 'Guidance Chamber', region: 'Unova',
          method: 'Dust Cloud', season: 'Any', horde_size: 0, is_lure: 0, is_special: 1,
          species_name: 'Lucario', slug: 'lucario', family_key: 'riolu',
          tier: 'Tier 0', points: 50, form: '', min_level: 36, max_level: 41,
          morning_rate: null, day_rate: null, night_rate: null,
        },
      ]),
    });

    const result = await repository.listHordeSpots({
      method: 'Singles', season: 'Summer', time: 'day', profile: { eventBoost: false },
    });

    expect(result.items[0].averagePoints).toBe(47.5);
    expect(result.items[0].pointsPerHour).toBe(0);
    expect(result.items[0].composition.every((entry) => entry.split === 0)).toBe(true);
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

  it.each(['All', 'Singles', 'Fishing'])('can exclude Safari encounters from %s', async (method) => {
    const runSelect = jest.fn().mockResolvedValue([]);
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(), runSelect,
    });

    await repository.listHordeSpots({ method, nonSafari: true });

    expect(runSelect.mock.calls[0][0]).toContain("LOWER(l.name) NOT LIKE '%safari%'");
    expect(runSelect.mock.calls[0][0]).toContain("LOWER(l.name) NOT LIKE '%great marsh%'");
  });

  it('can filter horde size across every encounter method', async () => {
    const runSelect = jest.fn().mockResolvedValue([]);
    const repository = createShinyWarRepository({
      dialect: 'd1', parameter: () => '?', runCommand: jest.fn(), runOne: jest.fn(), runSelect,
    });

    await repository.listHordeSpots({ method: 'All', hordeSize: '5' });

    expect(runSelect.mock.calls[0][0]).toContain('e.horde_size = ?');
    expect(runSelect.mock.calls[0][1]).toContain(5);
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
