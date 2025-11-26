const pool = require('../../server/src/config/connection');
const TeamMember = require('../../server/src/models/TeamMember');

jest.mock('../../server/src/config/connection', () => ({
  query: jest.fn(),
}));

describe('TeamMember model', () => {
  const mockQuery = require('../../server/src/config/connection').query;

  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('findAll returns rows from query', async () => {
    const rows = [{ id: 1, ign: 'MemberOne' }];
    mockQuery.mockResolvedValue({ rows });

    const result = await TeamMember.findAll();

    expect(mockQuery).toHaveBeenCalled();
    expect(result).toEqual(rows);
  });

  it('findById uses id parameter', async () => {
    const row = { id: 1, ign: 'MemberOne' };
    mockQuery.mockResolvedValue({ rows: [row] });

    const result = await TeamMember.findById(1);

    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [1]);
    expect(result).toEqual(row);
  });

  it('create inserts member and returns new row', async () => {
    const created = { id: 1, ign: 'NewMember' };
    mockQuery.mockResolvedValue({ rows: [created] });

    const result = await TeamMember.create({ ign: 'NewMember' });

    expect(mockQuery).toHaveBeenCalled();
    expect(result).toEqual(created);
  });

  it('update returns updated row', async () => {
    const updated = { id: 1, ign: 'Updated' };
    mockQuery.mockResolvedValue({ rows: [updated] });

    const result = await TeamMember.update(1, { ign: 'Updated' });

    expect(mockQuery).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  it('delete performs soft delete', async () => {
    const deleted = { id: 1, is_active: false };
    mockQuery.mockResolvedValue({ rows: [deleted] });

    const result = await TeamMember.delete(1);

    expect(mockQuery).toHaveBeenCalled();
    expect(result).toEqual(deleted);
  });

  it('getShinyStats returns stats rows', async () => {
    const stats = [{ encounter_type: 'horde', count_by_type: 3 }];
    mockQuery.mockResolvedValue({ rows: stats });

    const result = await TeamMember.getShinyStats(1);

    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [1]);
    expect(result).toEqual(stats);
  });
});
