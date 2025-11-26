const request = require('supertest');

const app = require('../../server/src/server');
const TeamShiny = require('../../server/src/models/TeamShiny');

jest.mock('../../server/src/models/TeamShiny');

describe('Shinies routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/shinies', () => {
    it('returns list of shinies with count', async () => {
      const shinies = [
        { id: 1, pokemon_name: 'pikachu' },
        { id: 2, pokemon_name: 'eevee' },
      ];
      TeamShiny.findAll.mockResolvedValue(shinies);

      const res = await request(app).get('/api/shinies?trainer_id=1&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(shinies);
      expect(res.body.count).toBe(shinies.length);
      expect(TeamShiny.findAll).toHaveBeenCalledTimes(1);
    });

    it('handles errors with 500', async () => {
      TeamShiny.findAll.mockRejectedValue(new Error('db error'));

      const res = await request(app).get('/api/shinies');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Failed to fetch team shinies');
    });
  });

  describe('GET /api/shinies/:id', () => {
    it('returns a shiny when found', async () => {
      TeamShiny.findById.mockResolvedValue({ id: 1, pokemon_name: 'pikachu' });

      const res = await request(app).get('/api/shinies/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pokemon_name).toBe('pikachu');
    });

    it('returns 404 when shiny not found', async () => {
      TeamShiny.findById.mockResolvedValue(null);

      const res = await request(app).get('/api/shinies/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Shiny not found');
    });
  });

  describe('GET /api/shinies/stats', () => {
    it('returns shiny statistics', async () => {
      const stats = [{ encounter_type: 'horde', count_by_type: 10 }];
      TeamShiny.getStats.mockResolvedValue(stats);

      const res = await request(app).get('/api/shinies/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(stats);
    });
  });

  describe('GET /api/shinies/leaderboard', () => {
    it('returns leaderboard data', async () => {
      const leaderboard = [{ ign: 'Trainer', shiny_count: 5 }];
      TeamShiny.getTopTrainers.mockResolvedValue(leaderboard);

      const res = await request(app).get('/api/shinies/leaderboard?limit=5');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(leaderboard);
      expect(TeamShiny.getTopTrainers).toHaveBeenCalledWith(5);
    });
  });

  describe('POST /api/shinies', () => {
    it('validates body and returns 400 on invalid payload', async () => {
      const res = await request(app)
        .post('/api/shinies')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation error');
    });

    it('creates shiny on valid payload', async () => {
      const created = { id: 1, pokemon: 'pikachu' };
      TeamShiny.create.mockResolvedValue(created);

      const res = await request(app)
        .post('/api/shinies')
        .send({
          national_number: 25,
          pokemon: 'pikachu',
          original_trainer: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          catch_date: new Date().toISOString(),
          encounter_type: 'horde',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(created);
      expect(res.body.message).toBe('Shiny entry created successfully');
    });

    it('handles foreign key violations with 400', async () => {
      const error = new Error('fk error');
      error.code = '23503';
      TeamShiny.create.mockRejectedValue(error);

      const res = await request(app)
        .post('/api/shinies')
        .send({
          national_number: 25,
          pokemon: 'pikachu',
          original_trainer: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          catch_date: new Date().toISOString(),
          encounter_type: 'horde',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid trainer ID or Pokemon number');
    });
  });

  describe('PUT /api/shinies/:id', () => {
    it('returns 400 for invalid body', async () => {
      const res = await request(app)
        .put('/api/shinies/1')
        .send({ national_number: 0 }); // invalid

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation error');
    });

    it('returns 404 when updating non-existent shiny', async () => {
      TeamShiny.update.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/shinies/999')
        .send({ notes: 'updated' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Shiny not found');
    });

    it('updates shiny when valid', async () => {
      const updated = { id: 1, pokemon: 'pikachu', notes: 'updated' };
      TeamShiny.update.mockResolvedValue(updated);

      const res = await request(app)
        .put('/api/shinies/1')
        .send({ notes: 'updated' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(updated);
      expect(res.body.message).toBe('Shiny entry updated successfully');
    });
  });

  describe('DELETE /api/shinies/:id', () => {
    it('returns 404 when shiny not found', async () => {
      TeamShiny.delete.mockResolvedValue(null);

      const res = await request(app).delete('/api/shinies/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Shiny not found');
    });

    it('deletes shiny when found', async () => {
      TeamShiny.delete.mockResolvedValue({ id: 1 });

      const res = await request(app).delete('/api/shinies/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Shiny entry deleted successfully');
    });
  });
});
