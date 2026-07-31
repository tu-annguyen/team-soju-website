const { createShinyWarRepository } = require('../src/cloudflare/repositories/shiny-war');
const { cleanQueue } = require('../src/cloudflare/routes/shiny-war');

describe('Cloudflare Shiny Wars repository', () => {
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
    expect(result.items[0].location).toBe('Pokemon Mansion 2F');
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
    expect(result.items[0].location).toBe('Pokemon Mansion 2F');
    expect(result.locations).toEqual(['Pokemon Mansion 2F', 'Viridian Forest']);
  });

  it('rejects malformed or oversized queues at the route boundary', () => {
    expect(cleanQueue([{ spot_key: 'spot', label: 'Mansion', details: {} }])).toHaveLength(1);
    expect(cleanQueue([{ spot_key: '', label: 'Missing spot' }])).toBeNull();
    expect(cleanQueue(Array.from({ length: 21 }, (_, index) => ({
      spot_key: `spot-${index}`, label: `Spot ${index}`,
    })))).toBeNull();
  });
});
