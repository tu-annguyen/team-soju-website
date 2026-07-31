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

  it('rejects malformed or oversized queues at the route boundary', () => {
    expect(cleanQueue([{ spot_key: 'spot', label: 'Mansion', details: {} }])).toHaveLength(1);
    expect(cleanQueue([{ spot_key: '', label: 'Missing spot' }])).toBeNull();
    expect(cleanQueue(Array.from({ length: 21 }, (_, index) => ({
      spot_key: `spot-${index}`, label: `Spot ${index}`,
    })))).toBeNull();
  });
});

