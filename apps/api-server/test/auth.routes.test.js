const request = require('supertest');

process.env.JWT_SECRET = 'test-secret';
process.env.DISCORD_CLIENT_ID = 'discord-client-id';
process.env.DISCORD_CLIENT_SECRET = 'discord-client-secret';
process.env.DISCORD_REDIRECT_URI = 'http://localhost:3001/api/auth/discord/callback';
process.env.WEB_APP_URL = 'http://localhost:4321';

const app = require('../src/server');
const User = require('../src/models/User');
const bcrypt = require('bcrypt');
const axios = require('axios');
const { AUTH_COOKIE_NAME, signUserToken } = require('../src/middleware/auth');

jest.mock('../src/models/User');
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));
jest.mock('axios');

describe('Auth routes', () => {
  const userRow = {
    id: 'user-id',
    email: 'trainer@example.com',
    ign: 'Trainer',
    password_hash: 'hashed-password',
    discord_id: null,
    auth_provider: 'password',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    User.toSafeUser.mockImplementation((row) => row ? ({
      id: row.id,
      email: row.email,
      ign: row.ign,
      discord_id: row.discord_id,
      auth_provider: row.auth_provider,
    }) : null);
    User.recordLogin.mockResolvedValue(userRow);
  });

  describe('POST /api/auth/register', () => {
    it('creates a user, signs them in, and sets the auth cookie', async () => {
      bcrypt.hash.mockResolvedValue('hashed-password');
      User.createWithPassword.mockResolvedValue(userRow);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'trainer@example.com',
          password: 'hunter42!',
          ign: 'Trainer',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.password_hash).toBeUndefined();
      expect(response.headers['set-cookie'][0]).toContain(`${AUTH_COOKIE_NAME}=`);
      expect(User.createWithPassword).toHaveBeenCalledWith({
        email: 'trainer@example.com',
        passwordHash: 'hashed-password',
        ign: 'Trainer',
      });
    });

    it('returns 409 for duplicate accounts', async () => {
      bcrypt.hash.mockResolvedValue('hashed-password');
      const error = new Error('duplicate');
      error.code = '23505';
      error.constraint = 'idx_app_users_email_lower';
      User.createWithPassword.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'trainer@example.com',
          password: 'hunter42!',
          ign: 'Trainer',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('An account with that email already exists.');
    });
  });

  describe('POST /api/auth/login', () => {
    it('signs in with email and password', async () => {
      User.findByEmail.mockResolvedValue(userRow);
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'trainer@example.com',
          password: 'hunter42!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.headers['set-cookie'][0]).toContain(`${AUTH_COOKIE_NAME}=`);
      expect(User.findByEmail).toHaveBeenCalledWith('trainer@example.com');
    });

    it('rejects invalid credentials', async () => {
      User.findByEmail.mockResolvedValue(userRow);
      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'trainer@example.com',
          password: 'wrong-password',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns null when there is no active session', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(200);
      expect(response.body.data).toBeNull();
    });

    it('returns the current user from a valid session cookie', async () => {
      const token = signUserToken(userRow);
      User.findById.mockResolvedValue(userRow);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', `${AUTH_COOKIE_NAME}=${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.ign).toBe('Trainer');
      expect(User.findById).toHaveBeenCalledWith('user-id');
    });
  });

  describe('Discord OAuth', () => {
    it('redirects to Discord with identify and email scopes', async () => {
      const response = await request(app)
        .get('/api/auth/discord?mode=register&ign=Trainer');

      expect(response.status).toBe(302);
      const redirectUrl = new URL(response.headers.location);
      expect(redirectUrl.origin + redirectUrl.pathname).toBe('https://discord.com/oauth2/authorize');
      expect(redirectUrl.searchParams.get('client_id')).toBe('discord-client-id');
      expect(redirectUrl.searchParams.get('scope')).toBe('identify email');
      expect(response.headers.location).toContain('scope=identify%20email');
      expect(redirectUrl.searchParams.get('state')).toBeTruthy();
    });

    it('creates a Discord account on callback when registering', async () => {
      const startResponse = await request(app)
        .get('/api/auth/discord?mode=register&ign=Trainer&returnTo=/auth');
      const state = new URL(startResponse.headers.location).searchParams.get('state');
      const discordUser = {
        id: 'discord-id',
        email: 'trainer@example.com',
        username: 'discord-user',
        global_name: 'Discord User',
        avatar: 'avatar-hash',
      };
      const discordAccount = {
        ...userRow,
        discord_id: 'discord-id',
        auth_provider: 'discord',
      };

      axios.post.mockResolvedValue({ data: { access_token: 'discord-token' } });
      axios.get.mockResolvedValue({ data: discordUser });
      User.findByDiscordId.mockResolvedValue(null);
      User.findByEmail.mockResolvedValue(null);
      User.createWithDiscord.mockResolvedValue(discordAccount);
      User.recordLogin.mockResolvedValue(discordAccount);

      const response = await request(app)
        .get(`/api/auth/discord/callback?code=oauth-code&state=${encodeURIComponent(state)}`);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('http://localhost:4321/auth?status=signed-in');
      expect(response.headers['set-cookie'][0]).toContain(`${AUTH_COOKIE_NAME}=`);
      expect(axios.post).toHaveBeenCalledWith(
        'https://discord.com/api/oauth2/token',
        expect.stringContaining('grant_type=authorization_code'),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );
      expect(User.createWithDiscord).toHaveBeenCalledWith({
        email: 'trainer@example.com',
        ign: 'Trainer',
        discord: discordUser,
      });
    });
  });
});
