const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';
process.env.IGN_BLACKLIST = 'BannedIGN';
process.env.DISCORD_CLIENT_ID = 'discord-client-id';
process.env.DISCORD_CLIENT_SECRET = 'discord-client-secret';
process.env.DISCORD_REDIRECT_URI = 'http://localhost:3001/api/auth/discord/callback';
process.env.WEB_APP_URL = 'http://localhost:4321';

const app = require('../src/server');
const User = require('../src/models/User');
const bcrypt = require('bcrypt');
const axios = require('axios');
const {
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} = require('../src/services/email');
const { AUTH_COOKIE_NAME, signUserToken } = require('../src/middleware/auth');

jest.mock('../src/models/User');
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));
jest.mock('axios');
jest.mock('../src/services/email', () => ({
  sendEmailVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

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
      email_verified_at: row.email_verified_at,
    }) : null);
    User.recordLogin.mockResolvedValue(userRow);
    sendEmailVerificationEmail.mockResolvedValue({ provider: 'test' });
    sendPasswordResetEmail.mockResolvedValue({ provider: 'test' });
  });

  describe('POST /api/auth/register', () => {
    it('creates a user, sends a verification email, and does not sign them in yet', async () => {
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
      expect(response.body.data).toBeNull();
      expect(response.body.message).toBe('Account created. Check your email to verify it before signing in.');
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(User.createWithPassword).toHaveBeenCalledWith({
        email: 'trainer@example.com',
        passwordHash: 'hashed-password',
        ign: 'Trainer',
        verificationTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        verificationExpiresAt: expect.any(Date),
      });
      expect(sendEmailVerificationEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'trainer@example.com',
        ign: 'Trainer',
        expiresInMinutes: 1440,
      }));
      expect(sendEmailVerificationEmail.mock.calls[0][0].verificationUrl)
        .toMatch(/^http:\/\/localhost:3001\/api\/auth\/verify-email\?token=[a-f0-9]{64}$/);
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

    it('deletes the unverified account if the verification email cannot be sent', async () => {
      bcrypt.hash.mockResolvedValue('hashed-password');
      User.createWithPassword.mockResolvedValue(userRow);
      User.deleteById.mockResolvedValue();
      const error = new Error('email unavailable');
      error.publicMessage = 'Email delivery is not configured yet.';
      sendEmailVerificationEmail.mockRejectedValue(error);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'trainer@example.com',
          password: 'hunter42!',
          ign: 'Trainer',
        });

      expect(response.status).toBe(503);
      expect(response.body.message).toBe('Email delivery is not configured yet.');
      expect(User.deleteById).toHaveBeenCalledWith('user-id');
    });

    it('rejects blacklisted IGNs during registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'trainer@example.com',
          password: 'hunter42!',
          ign: 'Banned IGN',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('That IGN is not allowed. Please choose a different in-game name.');
      expect(User.createWithPassword).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/login', () => {
    it('signs in with email and password', async () => {
      User.findByEmail.mockResolvedValue({
        ...userRow,
        email_verified_at: '2026-05-11T00:00:00.000Z',
      });
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

    it('rejects unverified accounts and resends verification email', async () => {
      User.findByEmail.mockResolvedValue({
        ...userRow,
        email_verified_at: null,
      });
      User.setEmailVerificationToken.mockResolvedValue(userRow);
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'trainer@example.com',
          password: 'hunter42!',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Verify your email before signing in. We sent you a new verification link.');
      expect(User.setEmailVerificationToken).toHaveBeenCalledWith('user-id', {
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      });
      expect(sendEmailVerificationEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'trainer@example.com',
        ign: 'Trainer',
        expiresInMinutes: 1440,
      }));
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

  describe('Password resets', () => {
    it('stores a reset token and sends a reset email for existing accounts', async () => {
      User.findByEmail.mockResolvedValue(userRow);
      User.setPasswordResetToken.mockResolvedValue(userRow);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'trainer@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'If an account uses that email, a reset link has been sent.',
      });
      expect(User.findByEmail).toHaveBeenCalledWith('trainer@example.com');
      expect(User.setPasswordResetToken).toHaveBeenCalledWith('user-id', {
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      });
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'trainer@example.com',
        expiresInMinutes: 60,
        ign: 'Trainer',
      }));
      expect(sendPasswordResetEmail.mock.calls[0][0].resetUrl)
        .toMatch(/^http:\/\/localhost:4321\/auth\?resetToken=[a-f0-9]{64}$/);
    });

    it('returns a generic response when the reset email has no matching account', async () => {
      User.findByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'missing@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('If an account uses that email, a reset link has been sent.');
      expect(User.setPasswordResetToken).not.toHaveBeenCalled();
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('resets a password from a valid token and signs the user in', async () => {
      const token = 'valid-reset-token-00000000000000000000';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const resetUser = {
        ...userRow,
        password_reset_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      };
      const updatedUser = {
        ...userRow,
        password_hash: 'new-hashed-password',
      };

      User.findByPasswordResetTokenHash.mockResolvedValue(resetUser);
      User.updatePassword.mockResolvedValue(updatedUser);
      User.recordLogin.mockResolvedValue(updatedUser);
      bcrypt.hash.mockResolvedValue('new-hashed-password');

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token,
          password: 'newhunter42!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.headers['set-cookie'][0]).toContain(`${AUTH_COOKIE_NAME}=`);
      expect(User.findByPasswordResetTokenHash).toHaveBeenCalledWith(tokenHash);
      expect(User.updatePassword).toHaveBeenCalledWith('user-id', 'new-hashed-password');
    });

    it('rejects expired reset tokens and clears them', async () => {
      User.findByPasswordResetTokenHash.mockResolvedValue({
        ...userRow,
        password_reset_expires_at: new Date(Date.now() - 1000).toISOString(),
      });
      User.clearPasswordResetToken.mockResolvedValue(userRow);

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'expired-reset-token-0000000000000000',
          password: 'newhunter42!',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('That password reset link is invalid or expired.');
      expect(User.clearPasswordResetToken).toHaveBeenCalledWith('user-id');
      expect(User.updatePassword).not.toHaveBeenCalled();
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

  describe('GET /api/auth/verify-email', () => {
    it('marks a matching verification token as verified and redirects to sign in', async () => {
      const token = 'a'.repeat(64);
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      User.findByEmailVerificationTokenHash.mockResolvedValue({
        ...userRow,
        email_verification_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
      User.markEmailVerified.mockResolvedValue({
        ...userRow,
        email_verified_at: new Date().toISOString(),
      });

      const response = await request(app)
        .get(`/api/auth/verify-email?token=${token}`);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('http://localhost:4321/auth?mode=login&status=email-verified');
      expect(User.findByEmailVerificationTokenHash).toHaveBeenCalledWith(tokenHash);
      expect(User.markEmailVerified).toHaveBeenCalledWith('user-id');
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

    it('blocks blacklisted IGNs before starting Discord registration', async () => {
      const response = await request(app)
        .get('/api/auth/discord?mode=register&ign=Banned%20IGN');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(
        'http://localhost:4321/auth?error=That+IGN+is+not+allowed.+Please+choose+a+different+in-game+name.'
      );
      expect(axios.post).not.toHaveBeenCalled();
      expect(User.createWithDiscord).not.toHaveBeenCalled();
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

    it('blocks blacklisted IGNs on Discord callback before account creation', async () => {
      const state = jwt.sign({
        type: 'discord_oauth_state',
        mode: 'register',
        ign: 'Banned IGN',
        returnTo: '/auth',
      }, process.env.JWT_SECRET, { expiresIn: '10m' });

      const response = await request(app)
        .get(`/api/auth/discord/callback?code=oauth-code&state=${encodeURIComponent(state)}`);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(
        'http://localhost:4321/auth?error=That+IGN+is+not+allowed.+Please+choose+a+different+in-game+name.'
      );
      expect(axios.post).not.toHaveBeenCalled();
      expect(axios.get).not.toHaveBeenCalled();
      expect(User.createWithDiscord).not.toHaveBeenCalled();
    });
  });
});
