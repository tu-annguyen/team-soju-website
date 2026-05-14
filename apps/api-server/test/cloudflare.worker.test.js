jest.mock('@team-soju/utils', () => ({
  getPokemonVariants: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getPokemonVariants } = require('@team-soju/utils');
const { AUTH_COOKIE_NAME, generateBotToken, signJwt } = require('../src/cloudflare/auth');
const { createWorkerApp, FeebasBoardStreamDurableObject } = require('../src/cloudflare/worker');

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

  it('exchanges Discord handoff tokens from the Worker and sets the browser session cookie', async () => {
    const repositories = {
      members: {},
      shinies: {},
      users: {
        findById: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'trainer@example.com',
          ign: 'Trainer',
          auth_provider: 'discord',
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
    const handoffToken = await signJwt({
      type: 'discord_oauth_handoff',
      sub: 'user-1',
    }, 'test-secret', { expiresIn: '2m' });

    const response = await app.fetch(new Request('https://api.example.com/api/auth/discord/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: handoffToken }),
    }), createEnv({ NODE_ENV: 'production' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      id: 'user-1',
      email: 'trainer@example.com',
      ign: 'Trainer',
      auth_provider: 'discord',
    });
    expect(response.headers.get('set-cookie')).toContain(`${AUTH_COOKIE_NAME}=`);
    expect(response.headers.get('set-cookie')).toContain('SameSite=None');
    expect(response.headers.get('set-cookie')).toContain('Secure');
    expect(repositories.users.findById).toHaveBeenCalledWith('user-1');
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

  it('serves Feebas SSE from the Worker repository contract', async () => {
    const board = {
      location: 'route-119-main',
      tiles: [],
      activity: [],
    };
    const fetchMock = jest.fn();
    const repositories = {
      members: {},
      shinies: {},
      users: {},
      feebas: {
        getBoard: jest.fn().mockResolvedValue(board),
      },
    };
    const app = createWorkerApp({
      repositories,
      fetch: fetchMock,
    });

    const response = await app.fetch(new Request('https://api.example.com/api/feebas/route-119-main/stream?actorFingerprint=client-12345678'), createEnv({
      LEGACY_API_BASE_URL: 'https://legacy.example.com',
    }));
    const reader = response.body.getReader();
    const firstChunk = await reader.read();
    await reader.cancel();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(repositories.feebas.getBoard).toHaveBeenCalledWith('route-119-main', {
      actorFingerprint: 'client-12345678',
      includeLeaderboard: false,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(new TextDecoder().decode(firstChunk.value)).toContain(JSON.stringify({ success: true, data: board }));
  });

  it('routes Feebas SSE through the Durable Object binding when available', async () => {
    const durableFetch = jest.fn().mockResolvedValue(new Response('durable stream', {
      headers: { 'content-type': 'text/event-stream' },
    }));
    const durableObjectBinding = {
      idFromName: jest.fn((name) => `id:${name}`),
      get: jest.fn(() => ({ fetch: durableFetch })),
    };
    const repositories = {
      members: {},
      shinies: {},
      users: {},
      feebas: {
        getBoard: jest.fn(),
      },
    };
    const app = createWorkerApp({ repositories });

    const response = await app.fetch(
      new Request('https://api.example.com/api/feebas/route-119-main/stream?actorFingerprint=client-12345678'),
      createEnv({ FEEBAS_BOARD_STREAM: durableObjectBinding })
    );
    const durableRequest = durableFetch.mock.calls[0][0];
    const durableUrl = new URL(durableRequest.url);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('durable stream');
    expect(repositories.feebas.getBoard).not.toHaveBeenCalled();
    expect(durableObjectBinding.idFromName).toHaveBeenCalledWith('route-119-main');
    expect(durableObjectBinding.get).toHaveBeenCalledWith('id:route-119-main');
    expect(durableRequest.method).toBe('GET');
    expect(durableUrl.pathname).toBe('/stream');
    expect(durableUrl.searchParams.get('location')).toBe('route-119-main');
    expect(durableUrl.searchParams.get('actorFingerprint')).toBe('client-12345678');
  });

  it('broadcasts Feebas updates through the Durable Object binding when available', async () => {
    const board = {
      location: 'route-119-main',
      tiles: [],
      activity: [],
    };
    const durableFetch = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const durableObjectBinding = {
      idFromName: jest.fn((name) => `id:${name}`),
      get: jest.fn(() => ({ fetch: durableFetch })),
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
    }), createEnv({ FEEBAS_BOARD_STREAM: durableObjectBinding }));
    const durableRequest = durableFetch.mock.calls[0][0];
    const durableUrl = new URL(durableRequest.url);

    expect(response.status).toBe(200);
    expect(repositories.feebas.updateTile).toHaveBeenCalledWith('route-119-main', 'r1c7', {
      status: 'pending',
      actorFingerprint: 'client-12345678',
      actorName: 'Trainer',
    }, {
      includeLeaderboard: false,
    });
    expect(durableObjectBinding.idFromName).toHaveBeenCalledWith('route-119-main');
    expect(durableRequest.method).toBe('POST');
    expect(durableUrl.pathname).toBe('/broadcast');
    expect(durableUrl.searchParams.get('location')).toBe('route-119-main');
  });

  it('streams and broadcasts Feebas boards from the Durable Object class', async () => {
    const initialBoard = {
      location: 'route-119-main',
      tiles: [{ tileId: 'r1c7', status: 'unchecked' }],
      activity: [],
    };
    const updatedBoard = {
      location: 'route-119-main',
      tiles: [{ tileId: 'r1c7', status: 'pending' }],
      activity: [],
    };
    const repositories = {
      feebas: {
        getBoard: jest.fn()
          .mockResolvedValueOnce(initialBoard)
          .mockResolvedValueOnce(updatedBoard),
      },
    };
    const durableObject = new FeebasBoardStreamDurableObject({}, {}, {
      createRepositories: () => repositories,
    });

    const streamResponse = await durableObject.fetch(new Request('https://feebas-board-stream.local/stream?location=route-119-main&actorFingerprint=client-12345678'));
    const reader = streamResponse.body.getReader();
    const firstChunk = await reader.read();

    const broadcastResponse = await durableObject.fetch(new Request('https://feebas-board-stream.local/broadcast?location=route-119-main', {
      method: 'POST',
    }));
    const nextChunk = await reader.read();
    await reader.cancel();

    expect(streamResponse.status).toBe(200);
    expect(streamResponse.headers.get('content-type')).toBe('text/event-stream');
    expect(broadcastResponse.status).toBe(204);
    expect(repositories.feebas.getBoard).toHaveBeenNthCalledWith(1, 'route-119-main', {
      actorFingerprint: 'client-12345678',
      includeLeaderboard: false,
    });
    expect(repositories.feebas.getBoard).toHaveBeenNthCalledWith(2, 'route-119-main', {
      actorFingerprint: 'client-12345678',
      includeLeaderboard: false,
    });
    expect(new TextDecoder().decode(firstChunk.value)).toContain(JSON.stringify({ success: true, data: initialBoard }));
    expect(new TextDecoder().decode(nextChunk.value)).toContain(JSON.stringify({ success: true, data: updatedBoard }));
  });

  it('broadcasts Feebas tile updates to Worker SSE subscribers', async () => {
    const initialBoard = {
      location: 'route-119-main',
      tiles: [{ id: 'r1c7', status: 'unchecked' }],
      activity: [],
    };
    const updatedBoard = {
      location: 'route-119-main',
      tiles: [{ id: 'r1c7', status: 'pending' }],
      activity: [],
    };
    const repositories = {
      members: {},
      shinies: {},
      users: {},
      feebas: {
        getBoard: jest.fn()
          .mockResolvedValueOnce(initialBoard)
          .mockResolvedValueOnce(updatedBoard),
        updateTile: jest.fn().mockResolvedValue(updatedBoard),
      },
    };
    const app = createWorkerApp({ repositories });

    const streamResponse = await app.fetch(new Request('https://api.example.com/api/feebas/route-119-main/stream?actorFingerprint=client-12345678'), createEnv());
    const reader = streamResponse.body.getReader();
    await reader.read();

    await app.fetch(new Request('https://api.example.com/api/feebas/route-119-main/tiles/r1c7', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'pending',
        actorFingerprint: 'client-12345678',
        actorName: 'Trainer',
      }),
    }), createEnv());
    const nextChunk = await reader.read();
    await reader.cancel();

    expect(repositories.feebas.getBoard).toHaveBeenLastCalledWith('route-119-main', {
      actorFingerprint: 'client-12345678',
      includeLeaderboard: false,
    });
    expect(new TextDecoder().decode(nextChunk.value)).toContain(JSON.stringify({ success: true, data: updatedBoard }));
  });

  it('polls Worker SSE subscribers for Feebas board changes missed by in-memory broadcast', async () => {
    jest.useFakeTimers();

    const initialBoard = {
      location: 'route-119-main',
      cycleStart: '2026-04-09T20:15:00.000Z',
      cycleEnd: '2026-04-09T21:00:00.000Z',
      tiles: [{ tileId: 'r1c7', status: 'unchecked', voteCounts: { checked: 0, pending: 0, confirmed: 0 }, totalVotes: 0, currentUserVote: 'unchecked' }],
      activity: [],
    };
    const updatedBoard = {
      ...initialBoard,
      tiles: [{ tileId: 'r1c7', status: 'pending', voteCounts: { checked: 0, pending: 1, confirmed: 0 }, totalVotes: 1, currentUserVote: 'unchecked' }],
      activity: [{
        id: 1,
        tileId: 'r1c7',
        actionType: 'voted',
        previousStatus: null,
        nextStatus: 'pending',
        actorName: 'Trainer',
        createdAt: '2026-04-09T20:20:00.000Z',
      }],
    };
    const repositories = {
      members: {},
      shinies: {},
      users: {},
      feebas: {
        getBoard: jest.fn()
          .mockResolvedValueOnce(initialBoard)
          .mockResolvedValueOnce(updatedBoard),
      },
    };
    const app = createWorkerApp({
      repositories,
      feebasStreamPollIntervalMs: 100,
    });

    try {
      const streamResponse = await app.fetch(new Request('https://api.example.com/api/feebas/route-119-main/stream?actorFingerprint=client-12345678'), createEnv());
      const reader = streamResponse.body.getReader();
      await reader.read();

      const nextChunkPromise = reader.read();
      await jest.advanceTimersByTimeAsync(100);
      const nextChunk = await nextChunkPromise;
      await reader.cancel();

      expect(repositories.feebas.getBoard).toHaveBeenCalledTimes(2);
      expect(new TextDecoder().decode(nextChunk.value)).toContain(JSON.stringify({ success: true, data: updatedBoard }));
    } finally {
      jest.useRealTimers();
    }
  });
});
