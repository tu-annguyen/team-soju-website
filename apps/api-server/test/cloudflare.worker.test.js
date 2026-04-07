jest.mock('@team-soju/utils', () => ({
  getPokemonVariants: jest.fn(),
}));

const { getPokemonVariants } = require('@team-soju/utils');
const { generateBotToken } = require('../src/cloudflare/auth');
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
});
