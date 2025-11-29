const pool = require('../src/config/connection');
const TeamShiny = require('../src/models/TeamShiny');

jest.mock('../src/config/connection', () => ({
  query: jest.fn(),
}));

describe('TeamShiny model', () => {
  const mockQuery = require('../src/config/connection').query;

  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('findAll builds query with filters and returns rows', async () => {
    const rows = [{ id: 1, pokemon_name: 'pikachu' }];
    mockQuery.mockResolvedValue({ rows });

    const filters = { trainer_id: 1, pokemon_name: 'pika', encounter_type: 'horde', is_secret: true, is_safari: false, limit: 10 };
    const result = await TeamShiny.findAll(filters);

    expect(mockQuery).toHaveBeenCalled();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('FROM team_shinies');
    expect(params).toEqual([1, '%pika%', 'horde', true, false, 10]);
    expect(result).toEqual(rows);
  });

  it('findById queries by id and returns row', async () => {
    const row = { id: 1, pokemon_name: 'pikachu' };
    mockQuery.mockResolvedValue({ rows: [row] });

    const result = await TeamShiny.findById(1);

    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [1]);
    expect(result).toEqual(row);
  });

  it('create inserts shiny and returns new row', async () => {
    const created = { id: 1, pokemon: 'pikachu' };
    mockQuery.mockResolvedValue({ rows: [created] });

    const result = await TeamShiny.create({
      national_number: 25,
      pokemon: 'pikachu',
      original_trainer: 'uuid-1',
      catch_date: new Date().toISOString(),
      encounter_type: 'horde',
    });

    expect(mockQuery).toHaveBeenCalled();
    expect(result).toEqual(created);
  });

  it('update updates shiny and returns row', async () => {
    const updated = { id: 1, pokemon: 'pikachu', notes: 'updated' };
    mockQuery.mockResolvedValue({ rows: [updated] });

    const result = await TeamShiny.update(1, { notes: 'updated' });

    expect(mockQuery).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  it('delete removes shiny and returns row', async () => {
    const deleted = { id: 1 };
    mockQuery.mockResolvedValue({ rows: [deleted] });

    const result = await TeamShiny.delete(1);

    expect(mockQuery).toHaveBeenCalled();
    expect(result).toEqual(deleted);
  });

  it('getStats returns aggregated stats', async () => {
    const stats = [{ encounter_type: 'horde', count_by_type: 10 }];
    mockQuery.mockResolvedValue({ rows: stats });

    const result = await TeamShiny.getStats();

    expect(mockQuery).toHaveBeenCalled();
    expect(result).toEqual(stats);
  });

  it('getTopTrainers returns leaderboard', async () => {
    const leaderboard = [{ ign: 'Trainer', shiny_count: 5 }];
    mockQuery.mockResolvedValue({ rows: leaderboard });

    const result = await TeamShiny.getTopTrainers(5);

    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [5]);
    expect(result).toEqual(leaderboard);
  });
});
