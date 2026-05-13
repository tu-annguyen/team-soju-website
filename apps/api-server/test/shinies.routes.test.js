const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('@team-soju/utils', () => ({
  capitalize: jest.fn(value => value),
  getNationalNumber: jest.fn(),
  getSpriteUrl: jest.fn(),
  greyscale: jest.fn(),
  getPokemonVariants: jest.fn(),
}));

process.env.JWT_SECRET = 'test-secret';

const app = require('../src/server');
const shiniesRouter = require('../src/routes/shinies');
const TeamShiny = require('../src/models/TeamShiny');
const { getPokemonVariants } = require('@team-soju/utils');

jest.mock('../src/models/TeamShiny');

const BOT_TOKEN = jwt.sign({ type: 'discord_bot' }, process.env.JWT_SECRET);
const withBotAuth = (testRequest) => testRequest.set('Authorization', `Bearer ${BOT_TOKEN}`);

describe('Shinies routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SCREENSHOT_DATA_API_BASE_URL;
    delete process.env.SCREENSHOT_DATA_API_BOT_TOKEN;
    global.fetch = undefined;
    getPokemonVariants.mockResolvedValue({
      national_number: null,
      variants: [],
    });
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

    it('passes active query parameter correctly', async () => {
      const shinies = [{ id: 3, pokemon_name: 'bulbasaur' }];
      TeamShiny.findAll.mockResolvedValue(shinies);

      const res = await request(app).get('/api/shinies?active=true');

      expect(res.status).toBe(200);
      expect(TeamShiny.findAll).toHaveBeenCalledWith({ active: true });
      expect(res.body.data).toEqual(shinies);
    });

    it('passes secondary sort query parameters correctly', async () => {
      TeamShiny.findAll.mockResolvedValue([]);

      const res = await request(app).get(
        '/api/shinies?sort_by=catch_date&sort_order=desc&secondary_sort_by=total_encounters&secondary_sort_order=asc'
      );

      expect(res.status).toBe(200);
      expect(TeamShiny.findAll).toHaveBeenCalledWith({
        active: true,
        sort_by: 'catch_date',
        sort_order: 'desc',
        secondary_sort_by: 'total_encounters',
        secondary_sort_order: 'asc',
      });
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
      const res = await withBotAuth(request(app)
        .post('/api/shinies')
        .send({}));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation error');
    });

    it('creates shiny on valid payload', async () => {
      const created = { id: 1, pokemon: 'pikachu' };
      TeamShiny.create.mockResolvedValue(created);
      getPokemonVariants.mockResolvedValue({
        national_number: 25,
        variants: ['pikachu'],
      });

      const res = await withBotAuth(request(app)
        .post('/api/shinies')
        .send({
          national_number: 25,
          pokemon: 'pikachu',
          variants: 'pikachu',
          original_trainer: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          catch_date: new Date().toISOString().split('T')[0],
          encounter_type: 'x5_horde',
        }));

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(created);
      expect(res.body.message).toBe('Shiny entry created successfully');
      expect(TeamShiny.create).toHaveBeenCalledWith(expect.objectContaining({
        pokemon: 'pikachu',
        national_number: 25,
        variants: 'pikachu',
      }));
    });

    it('handles foreign key violations with 400', async () => {
      const error = new Error('fk error');
      error.code = '23503';
      TeamShiny.create.mockRejectedValue(error);

      const res = await withBotAuth(request(app)
        .post('/api/shinies')
        .send({
          national_number: 25,
          pokemon: 'pikachu',
          original_trainer: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          catch_date: new Date().toISOString().split('T')[0],
          encounter_type: 'x5_horde',
        }));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid trainer ID or Pokemon number');
    });
  });

  describe('PUT /api/shinies/:id', () => {
    it('returns 400 for invalid body', async () => {
      const res = await withBotAuth(request(app)
        .put('/api/shinies/1')
        .send({ national_number: 0 })); // invalid

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation error');
    });

    it('returns 404 when updating non-existent shiny', async () => {
      TeamShiny.update.mockResolvedValue(null);

      const res = await withBotAuth(request(app)
        .put('/api/shinies/999')
        .send({ status: 'Sold' }));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Shiny not found');
    });

    it('updates shiny when valid', async () => {
      const updated = { id: 1, pokemon: 'pikachu', status: 'Sold' };
      TeamShiny.update.mockResolvedValue(updated);
      getPokemonVariants.mockResolvedValue({
        national_number: 25,
        variants: ['pikachu'],
      });

      const res = await withBotAuth(request(app)
        .put('/api/shinies/1')
        .send({ status: 'Sold' }));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(updated);
      expect(res.body.message).toBe('Shiny entry updated successfully');
      expect(TeamShiny.update).toHaveBeenCalledWith('1', expect.objectContaining({
        status: 'Sold',
      }));
    });

    it('accepts shiny status updates', async () => {
      const updated = { id: 1, pokemon: 'pikachu', status: 'Owned' };
      TeamShiny.update.mockResolvedValue(updated);

      const res = await withBotAuth(request(app)
        .put('/api/shinies/1')
        .send({ status: 'Owned' }));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(TeamShiny.update).toHaveBeenCalledWith('1', { status: 'Owned' });
      expect(res.body.data).toEqual(updated);
    });

    it('accepts variants updates', async () => {
      const updated = { id: 1, pokemon: 'basculin', variants: 'basculin-blue-striped' };
      TeamShiny.update.mockResolvedValue(updated);

      const res = await withBotAuth(request(app)
        .put('/api/shinies/1')
        .send({ variants: 'basculin-blue-striped' }));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(TeamShiny.update).toHaveBeenCalledWith('1', {
        variants: 'basculin-blue-striped',
      });
      expect(res.body.data).toEqual(updated);
    });

    it('hydrates variants when pokemon changes without explicit variants', async () => {
      const updated = { id: 1, pokemon: 'deerling', variants: 'deerling' };
      TeamShiny.update.mockResolvedValue(updated);
      getPokemonVariants.mockResolvedValue({
        national_number: 585,
        variants: ['deerling-spring', 'deerling-summer', 'deerling-autumn', 'deerling-winter'],
      });

      const res = await withBotAuth(request(app)
        .put('/api/shinies/1')
        .send({ pokemon: 'deerling' }));

      expect(res.status).toBe(200);
      expect(TeamShiny.update).toHaveBeenCalledWith('1', {
        pokemon: 'deerling',
        national_number: 585,
        variants: 'deerling',
      });
    });

    it('collapses nidoran route slugs into the base pokemon without creating variants', async () => {
      const updated = { id: 1, pokemon: 'nidoran', variants: 'nidoran' };
      TeamShiny.update.mockResolvedValue(updated);
      getPokemonVariants.mockResolvedValue({
        national_number: 29,
        variants: ['nidoran'],
      });

      const res = await withBotAuth(request(app)
        .put('/api/shinies/1')
        .send({ pokemon: 'nidoran-f' }));

      expect(res.status).toBe(200);
      expect(getPokemonVariants).toHaveBeenCalledWith('nidoran-f');
      expect(TeamShiny.update).toHaveBeenCalledWith('1', {
        pokemon: 'nidoran',
        national_number: 29,
        variants: 'nidoran',
      });
    });
  });

  describe('DELETE /api/shinies/:id', () => {
    it('returns 404 when shiny not found', async () => {
      TeamShiny.delete.mockResolvedValue(null);

      const res = await withBotAuth(request(app).delete('/api/shinies/999'));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Shiny not found');
    });

    it('deletes shiny when found', async () => {
      TeamShiny.delete.mockResolvedValue({ id: 1 });

      const res = await withBotAuth(request(app).delete('/api/shinies/1'));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Shiny entry deleted successfully');
    });
  });

  describe('screenshot data API migration helpers', () => {
    it('reads members from the configured Worker API instead of local models', async () => {
      const member = { id: 'member-1', ign: 'Trainer', discord_id: 'discord-1' };
      process.env.SCREENSHOT_DATA_API_BASE_URL = 'https://worker.example.com/api/';
      process.env.SCREENSHOT_DATA_API_BOT_TOKEN = 'worker-token';
      global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
        success: true,
        data: member,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));

      const result = await shiniesRouter._test.findMemberByDiscordId('discord-1');

      expect(result).toEqual(member);
      expect(global.fetch).toHaveBeenCalledWith('https://worker.example.com/api/members/discord/discord-1', expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer worker-token',
        }),
      }));
    });

    it('creates screenshot shinies through the configured Worker API', async () => {
      const shiny = { id: 'shiny-1', pokemon: 'pikachu' };
      const payload = {
        national_number: 25,
        pokemon: 'pikachu',
        original_trainer: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        catch_date: '2026-05-13',
        encounter_type: 'single',
      };
      process.env.SCREENSHOT_DATA_API_BASE_URL = 'https://worker.example.com/api';
      process.env.SCREENSHOT_DATA_API_BOT_TOKEN = 'worker-token';
      global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
        success: true,
        data: shiny,
      }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }));

      const result = await shiniesRouter._test.createShinyRecord(payload);

      expect(result).toEqual(shiny);
      expect(TeamShiny.create).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith('https://worker.example.com/api/shinies', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer worker-token',
        }),
      }));
    });
  });
});
