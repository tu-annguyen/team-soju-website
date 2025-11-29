const request = require('supertest');

const app = require('../src/server');
const TeamMember = require('../src/models/TeamMember');

jest.mock('../src/models/TeamMember');

describe('Members routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/members', () => {
    it('returns list of members', async () => {
      TeamMember.findAll.mockResolvedValue([
        { id: 1, ign: 'MemberOne', shiny_count: 3 },
      ]);

      const res = await request(app).get('/api/members');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(TeamMember.findAll).toHaveBeenCalledTimes(1);
    });

    it('handles errors with 500', async () => {
      TeamMember.findAll.mockRejectedValue(new Error('db error'));

      const res = await request(app).get('/api/members');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Failed to fetch team members');
    });
  });

  describe('GET /api/members/:id', () => {
    it('returns a member when found', async () => {
      TeamMember.findById.mockResolvedValue({ id: 1, ign: 'MemberOne' });

      const res = await request(app).get('/api/members/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ign).toBe('MemberOne');
      expect(TeamMember.findById).toHaveBeenCalledWith('1');
    });

    it('returns 404 when member not found', async () => {
      TeamMember.findById.mockResolvedValue(null);

      const res = await request(app).get('/api/members/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Team member not found');
    });
  });

  describe('POST /api/members', () => {
    it('validates body and returns 400 on invalid payload', async () => {
      const res = await request(app)
        .post('/api/members')
        .send({}); // missing ign

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation error');
    });

    it('creates member on valid payload', async () => {
      const created = { id: 1, ign: 'NewMember', rank: 'Member' };
      TeamMember.create.mockResolvedValue(created);

      const res = await request(app)
        .post('/api/members')
        .send({ ign: 'NewMember', rank: 'Member' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(created);
      expect(res.body.message).toBe('Team member created successfully');
      expect(TeamMember.create).toHaveBeenCalledTimes(1);
    });

    it('handles unique constraint violations with 409', async () => {
      const error = new Error('duplicate');
      error.code = '23505';
      TeamMember.create.mockRejectedValue(error);

      const res = await request(app)
        .post('/api/members')
        .send({ ign: 'ExistingMember' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('A member with this IGN or Discord ID already exists');
    });
  });

  describe('PUT /api/members/:id', () => {
    it('returns 400 for invalid body', async () => {
      const res = await request(app)
        .put('/api/members/1')
        .send({ ign: '' }); // fails Joi min length

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation error');
    });

    it('returns 404 when updating non-existent member', async () => {
      TeamMember.update.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/members/999')
        .send({ notes: 'updated' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Team member not found');
    });

    it('updates member when valid', async () => {
      const updated = { id: 1, ign: 'MemberOne', notes: 'updated' };
      TeamMember.update.mockResolvedValue(updated);

      const res = await request(app)
        .put('/api/members/1')
        .send({ notes: 'updated' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(updated);
      expect(res.body.message).toBe('Team member updated successfully');
    });
  });

  describe('DELETE /api/members/:id', () => {
    it('returns 404 when member not found', async () => {
      TeamMember.delete.mockResolvedValue(null);

      const res = await request(app).delete('/api/members/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Team member not found');
    });

    it('deactivates member when found', async () => {
      TeamMember.delete.mockResolvedValue({ id: 1, ign: 'MemberOne' });

      const res = await request(app).delete('/api/members/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Team member deactivated successfully');
    });
  });

  describe('GET /api/members/:id/stats', () => {
    it('returns shiny stats for member', async () => {
      const stats = [{ encounter_type: 'horde', count_by_type: 5 }];
      TeamMember.getShinyStats.mockResolvedValue(stats);

      const res = await request(app).get('/api/members/1/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(stats);
    });
  });
});
