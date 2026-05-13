jest.mock('@team-soju/utils', () => ({
  getPokemonVariants: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getPokemonVariants } = require('@team-soju/utils');
const { AUTH_COOKIE_NAME, generateBotToken } = require('../src/cloudflare/auth');
const { createWorkerApp } = require('../src/cloudflare/worker');

describe('Cloudflare Worker API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPokemonVariants.mockResolvedValue({
      national_number: 25,
      variants: ['pikachu'],
    });
  });

  function createEnv(overrides = {}) {
    return {
      JWT_SECRET: 'test-secret',
      NODE_ENV: 'development',
      DB_BACKEND: 'postgres',
      ...overrides,
    };
  }

  function createPbkdf2PasswordHash(password, saltHex = '00112233445566778899aabbccddeeff', iterations = 100000) {
    const hashHex = crypto
      .pbkdf2Sync(password, Buffer.from(saltHex, 'hex'), iterations, 32, 'sha256')
      .toString('hex');
    return `pbkdf2_sha256$${iterations}$${saltHex}$${hashHex}`;
  }

  it('returns the health payload', async () => {
    const app = createWorkerApp({
      repositories: {
        members: {},
        shinies: {},
      },
    });

    const response = await app.fetch(new Request('https://api.example.com/health'), createEnv());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Team Soju API is running');
    expect(typeof body.timestamp).toBe('string');
  });

  it('serves members from the repository contract', async () => {
    const repositories = {
      members: {
        findAll: jest.fn().mockResolvedValue([{ id: '1', ign: 'MemberOne', shiny_count: 3 }]),
      },
      shinies: {},
    };
    const app = createWorkerApp({ repositories });

    const response = await app.fetch(new Request('https://api.example.com/api/members'), createEnv());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(repositories.members.findAll).toHaveBeenCalledTimes(1);
    expect(body).toEqual({
      success: true,
      data: [{ id: '1', ign: 'MemberOne', shiny_count: 3 }],
    });
  });

  it('requires bot auth for protected routes', async () => {
    const app = createWorkerApp({
      repositories: {
        members: {},
        shinies: { create: jest.fn() },
      },
    });

    const response = await app.fetch(new Request('https://api.example.com/api/shinies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }), createEnv());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toBe('Access denied. No token provided.');
  });

  it('creates shinies with the same normalized payload contract', async () => {
    const repositories = {
      members: {},
      shinies: {
        create: jest.fn().mockResolvedValue({ id: 'shiny-1', pokemon: 'pikachu', variants: 'pikachu' }),
      },
    };
    const app = createWorkerApp({ repositories });
    const token = await generateBotToken('test-secret');

    const response = await app.fetch(new Request('https://api.example.com/api/shinies', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        national_number: 25,
        pokemon: 'pikachu',
        original_trainer: 'member-1',
        catch_date: '2026-04-06',
        encounter_type: 'single',
      }),
    }), createEnv());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(repositories.shinies.create).toHaveBeenCalledWith(expect.objectContaining({
      pokemon: 'pikachu',
      national_number: 25,
      variants: 'pikachu',
    }));
    expect(body.message).toBe('Shiny entry created successfully');
  });

  it('proxies legacy screenshot endpoints when configured', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), {
      status: 202,
      headers: { 'content-type': 'application/json' },
    }));
    const app = createWorkerApp({
      repositories: {
        members: {},
        shinies: {},
      },
      fetch: fetchMock,
    });
    const token = await generateBotToken('test-secret');

    const response = await app.fetch(new Request('https://api.example.com/api/shinies/from-screenshot/async', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ screenshot_url: 'https://example.com/screenshot.png' }),
    }), createEnv({ LEGACY_API_BASE_URL: 'https://legacy.example.com' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0].toString()).toBe('https://legacy.example.com/api/shinies/from-screenshot/async');
    expect(response.status).toBe(202);
  });

  it('returns 501 for legacy-only endpoints without a proxy target', async () => {
    const app = createWorkerApp({
      repositories: {
        members: {},
        shinies: {},
      },
    });

    const response = await app.fetch(new Request('https://api.example.com/api/shinies/from-screenshot'), createEnv());
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.message).toContain('legacy Node API');
  });

  it('serves auth/me from the Worker repository contract', async () => {
    const repositories = {
      members: {},
      shinies: {},
      users: {
        findById: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'trainer@example.com',
          ign: 'Trainer',
          password_hash: 'secret',
          auth_provider: 'password',
        }),
        toSafeUser: jest.fn((user) => ({
          id: user.id,
          email: user.email,
          ign: user.ign,
          auth_provider: user.auth_provider,
        })),
      },
    };
    const app = createWorkerApp({ repositories });
    const token = jwt.sign({
      type: 'web_user',
      sub: 'user-1',
      email: 'trainer@example.com',
      ign: 'Trainer',
    }, 'test-secret', { expiresIn: '14d' });

    const response = await app.fetch(new Request('https://api.example.com/api/auth/me', {
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
    }), createEnv());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(repositories.users.findById).toHaveBeenCalledWith('user-1');
    expect(body).toEqual({
      success: true,
      data: {
        id: 'user-1',
        email: 'trainer@example.com',
        ign: 'Trainer',
        auth_provider: 'password',
      },
    });
  });

  it('falls back to legacy auth/me locally when D1 does not have the signed-in user yet', async () => {
    const legacyBody = {
      success: true,
      data: {
        id: 'user-1',
        email: 'trainer@example.com',
        ign: 'Trainer',
        auth_provider: 'password',
      },
    };
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify(legacyBody), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const repositories = {
      members: {},
      shinies: {},
      users: {
        findById: jest.fn().mockResolvedValue(null),
      },
    };
    const app = createWorkerApp({ repositories, fetch: fetchMock });
    const token = jwt.sign({
      type: 'web_user',
      sub: 'user-1',
      email: 'trainer@example.com',
      ign: 'Trainer',
    }, 'test-secret', { expiresIn: '14d' });

    const response = await app.fetch(new Request('https://api.example.com/api/auth/me', {
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
    }), createEnv({
      LEGACY_API_BASE_URL: 'http://localhost:3001',
      NODE_ENV: 'development',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0].toString()).toBe('http://localhost:3001/api/auth/me');
    expect(body).toEqual(legacyBody);
  });

  it('serves auth update routes from the Worker instead of the legacy proxy', async () => {
    const repositories = {
      members: {},
      shinies: {},
      users: {
        findByEmail: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'trainer@example.com',
          ign: 'Trainer',
        }),
        setPasswordResetToken: jest.fn().mockResolvedValue({}),
        clearPasswordResetToken: jest.fn(),
      },
    };
    const fetchMock = jest.fn();
    const app = createWorkerApp({ repositories, fetch: fetchMock });

    const response = await app.fetch(new Request('https://api.example.com/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'trainer@example.com' }),
    }), createEnv({
      LEGACY_API_BASE_URL: 'https://legacy.example.com',
      NODE_ENV: 'test',
      EMAIL_PROVIDER: 'console',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(repositories.users.findByEmail).toHaveBeenCalledWith('trainer@example.com');
    expect(repositories.users.setPasswordResetToken).toHaveBeenCalledWith('user-1', {
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: expect.any(Date),
    });
    expect(body.message).toBe('If an account uses that email, a reset link has been sent.');
  });

  it('serves auth/login from D1 and returns a reset message for bcrypt-era passwords', async () => {
    const repositories = {
      members: {},
      shinies: {},
      users: {
        findByEmail: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'trainer@example.com',
          ign: 'Trainer',
          password_hash: '$2b$12$legacybcrypt',
          email_verified_at: '2026-05-13T00:00:00.000Z',
          auth_provider: 'password',
        }),
      },
    };
    const fetchMock = jest.fn();
    const app = createWorkerApp({ repositories, fetch: fetchMock });

    const response = await app.fetch(new Request('https://api.example.com/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'trainer@example.com', password: 'hunter42!' }),
    }), createEnv({ LEGACY_API_BASE_URL: 'https://legacy.example.com' }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(body.message).toContain('Please reset your password');
  });

  it('signs in D1 password users with Worker-compatible password hashes', async () => {
    const repositories = {
      members: {},
      shinies: {},
      users: {
        findByEmail: jest.fn(),
        recordLogin: jest.fn(),
        toSafeUser: jest.fn((user) => ({
          id: user.id,
          email: user.email,
          ign: user.ign,
          auth_provider: user.auth_provider,
        })),
      },
    };
    const app = createWorkerApp({ repositories });

    const user = {
      id: 'user-1',
      email: 'trainer@example.com',
      ign: 'Trainer',
      password_hash: createPbkdf2PasswordHash('hunter42!'),
      email_verified_at: '2026-05-13T00:00:00.000Z',
      auth_provider: 'password',
    };
    repositories.users.findByEmail.mockResolvedValue(user);
    repositories.users.recordLogin.mockResolvedValue(user);

    const response = await app.fetch(new Request('https://api.example.com/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'trainer@example.com', password: 'hunter42!' }),
    }), createEnv());

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain(`${AUTH_COOKIE_NAME}=`);
  });

  it('starts Discord OAuth from the Worker instead of the legacy proxy', async () => {
    const fetchMock = jest.fn();
    const app = createWorkerApp({
      repositories: {
        members: {},
        shinies: {},
        users: {},
      },
      fetch: fetchMock,
    });

    const response = await app.fetch(new Request('https://api.example.com/api/auth/discord?mode=register&ign=Trainer'), createEnv({
      LEGACY_API_BASE_URL: 'https://legacy.example.com',
      DISCORD_CLIENT_ID: 'discord-client',
      DISCORD_CLIENT_SECRET: 'discord-secret',
      DISCORD_REDIRECT_URI: 'https://api.example.com/api/auth/discord/callback',
    }));

    expect(response.status).toBe(302);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toContain('https://discord.com/oauth2/authorize');
    expect(response.headers.get('location')).toContain('client_id=discord-client');
  });

  it('passes the signed-in user to Feebas leaderboard routes', async () => {
    const leaderboard = {
      location: 'route-119-main',
      entries: [],
    };
    const repositories = {
      members: {},
      shinies: {},
      users: {
        findById: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'trainer@example.com',
          ign: 'Trainer',
        }),
      },
      feebas: {
        getLeaderboardSortOptions: jest.fn().mockReturnValue([{ key: 'ign' }]),
        getLeaderboard: jest.fn().mockResolvedValue(leaderboard),
      },
    };
    const app = createWorkerApp({ repositories });
    const token = jwt.sign({
      type: 'web_user',
      sub: 'user-1',
      email: 'trainer@example.com',
      ign: 'Trainer',
    }, 'test-secret', { expiresIn: '14d' });

    const response = await app.fetch(new Request('https://api.example.com/api/feebas/route-119-main/leaderboard?limit=5&sortBy=ign', {
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
    }), createEnv());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(repositories.users.findById).toHaveBeenCalledWith('user-1');
    expect(repositories.feebas.getLeaderboard).toHaveBeenCalledWith('route-119-main', {
      limit: 5,
      sortBy: 'ign',
      currentUserId: 'user-1',
    });
    expect(body.data).toEqual(leaderboard);
  });

  it('serves Feebas board REST routes from the Worker repository contract', async () => {
    const board = {
      location: 'route-119-main',
      tiles: [],
      activity: [],
    };
    const repositories = {
      members: {},
      shinies: {},
      users: {},
      feebas: {
        getBoard: jest.fn().mockResolvedValue(board),
      },
    };
    const app = createWorkerApp({ repositories });

    const response = await app.fetch(new Request('https://api.example.com/api/feebas/route-119-main?actorFingerprint=client-12345678'), createEnv());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(repositories.feebas.getBoard).toHaveBeenCalledWith('route-119-main', {
      actorFingerprint: 'client-12345678',
    });
    expect(body).toEqual({
      success: true,
      data: board,
    });
  });

  it('updates Feebas tiles through the Worker repository contract', async () => {
    const board = {
      location: 'route-119-main',
      tiles: [],
      activity: [],
    };
    const repositories = {
      members: {},
      shinies: {},
      users: {},
      feebas: {
        updateTile: jest.fn().mockResolvedValue(board),
      },
    };
    const app = createWorkerApp({ repositories });

    const response = await app.fetch(new Request('https://api.example.com/api/feebas/route-119-main/tiles/r1c7', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'pending',
        actorFingerprint: 'client-12345678',
        actorName: 'Trainer',
      }),
    }), createEnv());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(repositories.feebas.updateTile).toHaveBeenCalledWith('route-119-main', 'r1c7', {
      status: 'pending',
      actorFingerprint: 'client-12345678',
      actorName: 'Trainer',
    }, {
      includeLeaderboard: false,
    });
    expect(body.message).toBe('Feebas tile updated successfully');
  });

  it('keeps Feebas SSE on the legacy API during migration', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response('data: {}\n\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }));
    const app = createWorkerApp({
      repositories: {
        members: {},
        shinies: {},
      },
      fetch: fetchMock,
    });

    const response = await app.fetch(new Request('https://api.example.com/api/feebas/route-119-main/stream?actorFingerprint=client-12345678'), createEnv({
      LEGACY_API_BASE_URL: 'https://legacy.example.com',
    }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0].toString()).toBe('https://legacy.example.com/api/feebas/route-119-main/stream?actorFingerprint=client-12345678');
    expect(response.status).toBe(200);
  });
});
