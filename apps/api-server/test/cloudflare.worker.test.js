jest.mock('@team-soju/utils', () => ({
  getPokemonVariants: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getPokemonVariants } = require('@team-soju/utils');
const { AUTH_COOKIE_NAME, generateBotToken, signJwt } = require('../src/cloudflare/auth');
const { createWorkerApp, FeebasBoardStreamDurableObject } = require('../src/cloudflare/worker');

class MockWebSocket {
  constructor() {
    this.accepted = false;
    this.closed = false;
    this.received = [];
    this.sent = [];
    this.listeners = new Map();
    this.attachment = null;
    this.peer = null;
  }

  accept() {
    this.accepted = true;
  }

  send(message) {
    if (this.closed) {
      throw new Error('WebSocket is closed.');
    }

    this.sent.push(message);
    this.peer?.receive(message);
  }

  receive(message) {
    this.received.push(message);
    this.emit('message', { data: message });
  }

  close() {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.emit('close', {});
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type, event) {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  serializeAttachment(attachment) {
    this.attachment = attachment;
  }

  deserializeAttachment() {
    return this.attachment;
  }
}

class MockWebSocketPair {
  constructor() {
    const client = new MockWebSocket();
    const server = new MockWebSocket();
    client.peer = server;
    server.peer = client;
    return { 0: client, 1: server };
  }
}

function createWebSocketRequest(url) {
  return new Request(url, {
    headers: {
      Upgrade: 'websocket',
    },
  });
}

function createDurableObjectState() {
  const sockets = [];
  return {
    acceptWebSocket: jest.fn((socket) => {
      socket.accept();
      sockets.push(socket);
    }),
    getWebSockets: jest.fn(() => sockets.filter((socket) => !socket.closed)),
    sockets,
  };
}

describe('Cloudflare Worker API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.WebSocketPair = MockWebSocketPair;
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

  it('generates long-lived bot tokens for Worker auth', async () => {
    const token = await generateBotToken('test-secret');
    const decoded = jwt.verify(token, 'test-secret');

    expect(decoded).toEqual(expect.objectContaining({
      type: 'discord_bot',
      permissions: expect.arrayContaining(['read', 'write', 'delete']),
    }));
    expect(decoded.exp).toBeUndefined();
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

  it('returns a clear error when catch event OCR is not configured', async () => {
    const app = createWorkerApp({
      repositories: {
        members: {},
        shinies: {},
        catchEvents: {},
      },
    });

    const response = await app.fetch(new Request('https://api.example.com/api/catch-events/ocr', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        screenshots: [{
          name: 'summary.png',
          contentType: 'image/png',
          dataUrl: 'data:image/png;base64,AAAA',
        }],
      }),
    }), createEnv());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.message).toBe('OCR is not configured for this environment.');
  });

  it('reads catch event OCR screenshots one image at a time and merges the result', async () => {
    const app = createWorkerApp({
      repositories: {
        members: {},
        shinies: {},
        catchEvents: {},
      },
    });
    const aiRun = jest.fn()
      .mockResolvedValueOnce({ response: JSON.stringify({ playerIgn: 'tunacore', species: 'Milotic', confidence: 0.9, warnings: [] }) })
      .mockResolvedValueOnce({ response: JSON.stringify({ totalIv: 140, confidence: 0.8, warnings: [] }) })
      .mockResolvedValueOnce({ response: JSON.stringify({ catchLocal: '2026-04-12T23:31:35', location: 'Route 3', confidence: 0.7, warnings: [] }) });

    const response = await app.fetch(new Request('https://api.example.com/api/catch-events/ocr', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        screenshots: [
          { name: 'summary.png', contentType: 'image/png', dataUrl: 'data:image/png;base64,AAAA' },
          { name: 'ivs.png', contentType: 'image/png', dataUrl: 'data:image/png;base64,BBBB' },
          { name: 'info.png', contentType: 'image/png', dataUrl: 'data:image/png;base64,CCCC' },
        ],
      }),
    }), createEnv({ AI: { run: aiRun } }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(aiRun).toHaveBeenCalledTimes(3);
    expect(body.data).toEqual(expect.objectContaining({
      playerIgn: 'tunacore',
      species: 'Milotic',
      totalIv: 140,
      catchLocal: '2026-04-12T23:31:35',
      location: 'Route 3',
    }));
  });

  it('passes event window context to catch event OCR date normalization', async () => {
    const app = createWorkerApp({
      repositories: {
        members: {},
        shinies: {},
        catchEvents: {},
      },
    });
    const aiRun = jest.fn()
      .mockResolvedValueOnce({ response: JSON.stringify({ catchLocal: '7/6/26 10:40:05 AM', confidence: 0.7, warnings: [] }) });

    const response = await app.fetch(new Request('https://api.example.com/api/catch-events/ocr', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        screenshots: [
          { name: 'info.png', contentType: 'image/png', role: 'information', dataUrl: 'data:image/png;base64,AAAA' },
        ],
        locale: 'en-US',
        timezone: 'America/Los_Angeles',
        eventStartLocal: '2026-06-07T10:00:00',
        eventEndLocal: '2026-06-07T11:00:00',
        eventTimezone: 'America/Los_Angeles',
      }),
    }), createEnv({ AI: { run: aiRun } }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(expect.objectContaining({
      catchLocal: '2026-06-07T10:40:05',
      dateOrder: 'dmy',
    }));
    expect(body.data.warnings).toEqual(expect.arrayContaining([
      'Date order inferred from browser settings as MDY.',
      'Ambiguous date matched using the event time window.',
    ]));
  });

  it('does not let null total IV results mask the IV screenshot value', async () => {
    const app = createWorkerApp({
      repositories: {
        members: {},
        shinies: {},
        catchEvents: {},
      },
    });
    const aiRun = jest.fn()
      .mockResolvedValueOnce({ response: JSON.stringify({ playerIgn: 'tunacore', species: 'Weezing', totalIv: null, confidence: 0.9, warnings: [] }) })
      .mockResolvedValueOnce({ response: JSON.stringify({ totalIv: 116, confidence: 0.8, warnings: [] }) })
      .mockResolvedValueOnce({ response: JSON.stringify({ catchLocal: '2026-04-12T23:31:35', totalIv: null, confidence: 0.7, warnings: [] }) });

    const response = await app.fetch(new Request('https://api.example.com/api/catch-events/ocr', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        screenshots: [
          { name: 'summary.png', contentType: 'image/png', role: 'nature-ot', dataUrl: 'data:image/png;base64,AAAA' },
          { name: 'ivs.png', contentType: 'image/png', role: 'ivs', dataUrl: 'data:image/png;base64,BBBB' },
          { name: 'info.png', contentType: 'image/png', role: 'information', dataUrl: 'data:image/png;base64,CCCC' },
        ],
      }),
    }), createEnv({ AI: { run: aiRun } }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(expect.objectContaining({
      species: 'Weezing',
      totalIv: 116,
      catchLocal: '2026-04-12T23:31:35',
    }));
  });

  it('falls back to Workers AI REST when the local AI binding cannot run', async () => {
    const app = createWorkerApp({
      repositories: {
        members: {},
        shinies: {},
        catchEvents: {},
      },
    });
    const aiRun = jest.fn().mockRejectedValue(new Error('Binding AI needs to be run remotely'));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        result: {
          response: JSON.stringify({
            species: 'Milotic',
            totalIv: 140,
            confidence: 0.9,
            warnings: [],
          }),
        },
      }),
    });

    const response = await app.fetch(new Request('https://api.example.com/api/catch-events/ocr', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        screenshots: [
          { name: 'summary.png', contentType: 'image/png', dataUrl: 'data:image/png;base64,AAAA' },
        ],
      }),
    }), createEnv({
      AI: { run: aiRun },
      CLOUDFLARE_ACCOUNT_ID: 'account-id',
      CLOUDFLARE_API_TOKEN: 'api-token',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(aiRun).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/account-id/ai/run/@cf/google/gemma-3-12b-it',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer api-token',
          'content-type': 'application/json',
        }),
      })
    );
    expect(body.data).toEqual(expect.objectContaining({
      species: 'Milotic',
      totalIv: 140,
    }));

    fetchSpy.mockRestore();
  });

  it('returns a clear local-dev OCR error when Workers AI REST credentials are missing', async () => {
    const app = createWorkerApp({
      repositories: {
        members: {},
        shinies: {},
        catchEvents: {},
      },
    });
    const aiRun = jest.fn().mockRejectedValue(new Error('Binding AI needs to be run remotely'));

    const response = await app.fetch(new Request('https://api.example.com/api/catch-events/ocr', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        screenshots: [
          { name: 'summary.png', contentType: 'image/png', dataUrl: 'data:image/png;base64,AAAA' },
        ],
      }),
    }), createEnv({ AI: { run: aiRun } }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.message).toContain('CLOUDFLARE_ACCOUNT_ID');
    expect(body.message).toContain('CLOUDFLARE_API_TOKEN');
  });

  it('lists catch events through the public repository view', async () => {
    const repositories = {
      members: {},
      shinies: {},
      catchEvents: {
        listEvents: jest.fn().mockResolvedValue([{ id: 'public-event', isPrivate: false }]),
      },
    };
    const app = createWorkerApp({ repositories });

    const response = await app.fetch(new Request('https://api.example.com/api/catch-events'), createEnv());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(repositories.catchEvents.listEvents).toHaveBeenCalledWith({
      manageableByUserId: undefined,
      publishedOnly: false,
    });
    expect(body.data).toEqual([{ id: 'public-event', isPrivate: false }]);
  });

  it('defaults created catch events to private when the client omits visibility', async () => {
    const repositories = {
      members: {},
      shinies: {},
      users: {
        findById: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'trainer@example.com',
          ign: 'Trainer',
          auth_provider: 'password',
        }),
      },
      catchEvents: {
        createEvent: jest.fn().mockResolvedValue({ id: 'private-event', isPrivate: true }),
      },
    };
    const app = createWorkerApp({ repositories });
    const token = jwt.sign({
      type: 'web_user',
      sub: 'user-1',
      email: 'trainer@example.com',
      ign: 'Trainer',
    }, 'test-secret', { expiresIn: '14d' });

    const response = await app.fetch(new Request('https://api.example.com/api/catch-events', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({
        id: 'private-event',
        slug: 'private-event',
        name: 'Private Event',
        eventDate: '2026-05-20',
        startLocal: '2026-05-20T10:00',
        endLocal: '2026-05-20T11:00',
        timezone: 'America/Los_Angeles',
        region: 'Hoenn',
        route: 'Route 119',
        winnerCount: 4,
        targets: ['Milotic'],
      }),
    }), createEnv());

    expect(response.status).toBe(201);
    expect(repositories.catchEvents.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      expect.objectContaining({ isPrivate: true })
    );
  });

  it('rejects catch event submissions with event-critical mismatches before storing them', async () => {
    const event = {
      id: 'event-1',
      startLocal: '2026-05-23T01:00',
      endLocal: '2026-05-23T02:30',
      timezone: 'America/Los_Angeles',
      region: 'Sinnoh',
      route: 'Mt. Coronet',
      targets: ['Feebas'],
      speciesBonuses: [],
      speciesPenalties: [],
      natureBonuses: [],
      naturePenalties: [],
      autoCheckEnabled: true,
      submissionsClosed: false,
    };
    const repositories = {
      members: {},
      shinies: {},
      catchEvents: {
        getEventById: jest.fn().mockResolvedValue(event),
        upsertSubmission: jest.fn(),
      },
    };
    const app = createWorkerApp({ repositories });

    const response = await app.fetch(new Request('https://api.example.com/api/catch-events/event-1/submissions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        playerIgn: 'pearpear',
        species: 'Milotic',
        nature: 'Docile',
        totalIv: 141,
        catchLocal: '2023-05-23T02:20:58',
        timezone: 'America/Los_Angeles',
        region: 'Sinnoh',
        route: 'Mt. Coronet',
        catchUtc: '2023-05-23T09:20:58.000Z',
        score: 999,
        status: 'auto-checked',
        flags: [],
        screenshots: [],
      }),
    }), createEnv());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errors).toEqual(expect.arrayContaining([
      'Species is not allowed for this event',
      'Catch time is outside the event window',
    ]));
    expect(body.message).toBe('Species is not allowed for this event; Catch time is outside the event window');
    expect(repositories.catchEvents.upsertSubmission).not.toHaveBeenCalled();
  });

  it('recomputes accepted catch event submissions without nature scoring server-side', async () => {
    const event = {
      id: 'event-1',
      startLocal: '2026-05-23T01:00',
      endLocal: '2026-05-23T02:30',
      timezone: 'America/Los_Angeles',
      region: 'Sinnoh',
      route: 'Mt. Coronet',
      targets: ['Feebas'],
      speciesBonuses: [{ name: 'Feebas', points: 5 }],
      speciesPenalties: [],
      natureBonuses: [],
      naturePenalties: [],
      autoCheckEnabled: true,
      submissionsClosed: false,
    };
    const repositories = {
      members: {},
      shinies: {},
      catchEvents: {
        getEventById: jest.fn().mockResolvedValue(event),
        upsertSubmission: jest.fn().mockResolvedValue({
          submission: { id: 'submission-1' },
          replaced: false,
        }),
      },
    };
    const app = createWorkerApp({ repositories });

    const response = await app.fetch(new Request('https://api.example.com/api/catch-events/event-1/submissions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        playerIgn: 'pearpear',
        species: 'Feebas',
        nature: '',
        totalIv: 141,
        catchLocal: '2026-05-23T02:20:58',
        timezone: 'America/Los_Angeles',
        region: 'Sinnoh',
        route: 'Mt. Coronet',
        catchUtc: '2020-01-01T00:00:00.000Z',
        score: 1,
        status: 'pending-verification',
        flags: ['client flag'],
        screenshots: [],
      }),
    }), createEnv());

    expect(response.status).toBe(201);
    expect(repositories.catchEvents.upsertSubmission).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({
        nature: '',
        catchUtc: '2026-05-23T09:20:58.000Z',
        score: 146,
        status: 'auto-checked',
        flags: [],
      }),
      []
    );
  });

  it('rejects blank nature when the catch event has nature scoring', async () => {
    const event = {
      id: 'event-1',
      startLocal: '2026-05-23T01:00',
      endLocal: '2026-05-23T02:30',
      timezone: 'America/Los_Angeles',
      region: 'Sinnoh',
      route: 'Mt. Coronet',
      targets: ['Feebas'],
      speciesBonuses: [],
      speciesPenalties: [],
      natureBonuses: [{ name: 'Docile', points: 5 }],
      naturePenalties: [],
      autoCheckEnabled: true,
      submissionsClosed: false,
    };
    const repositories = {
      members: {},
      shinies: {},
      catchEvents: {
        getEventById: jest.fn().mockResolvedValue(event),
        upsertSubmission: jest.fn(),
      },
    };
    const app = createWorkerApp({ repositories });

    const response = await app.fetch(new Request('https://api.example.com/api/catch-events/event-1/submissions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        playerIgn: 'pearpear',
        species: 'Feebas',
        nature: '',
        totalIv: 141,
        catchLocal: '2026-05-23T02:20:58',
        timezone: 'America/Los_Angeles',
        region: 'Sinnoh',
        route: 'Mt. Coronet',
        catchUtc: '2020-01-01T00:00:00.000Z',
        score: 1,
        status: 'pending-verification',
        flags: [],
        screenshots: [],
      }),
    }), createEnv());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errors).toContain('Nature is not one of the standard Pokemon natures');
    expect(repositories.catchEvents.upsertSubmission).not.toHaveBeenCalled();
  });

  it('rejects manual catch event status updates to needs-review', async () => {
    const manager = {
      id: 'owner-1',
      email: 'owner@example.com',
      ign: 'Owner',
      auth_provider: 'password',
    };
    const repositories = {
      members: {},
      shinies: {},
      users: {
        findById: jest.fn().mockResolvedValue(manager),
      },
      catchEvents: {
        updateSubmissionStatus: jest.fn(),
      },
    };
    const app = createWorkerApp({ repositories });
    const token = jwt.sign({
      type: 'web_user',
      sub: 'owner-1',
      email: 'owner@example.com',
      ign: 'Owner',
    }, 'test-secret', { expiresIn: '14d' });

    const response = await app.fetch(new Request('https://api.example.com/api/catch-events/event-1/submissions/submission-1/status', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({ status: 'needs-review' }),
    }), createEnv());

    expect(response.status).toBe(400);
    expect(repositories.catchEvents.updateSubmissionStatus).not.toHaveBeenCalled();
  });

  it('lets an owner add and remove catch event shared admins by email or IGN', async () => {
    const owner = {
      id: 'owner-1',
      email: 'owner@example.com',
      ign: 'Owner',
      auth_provider: 'password',
    };
    const collaborator = {
      id: 'cohost-1',
      email: 'cohost@example.com',
      ign: 'CoHost',
      auth_provider: 'password',
    };
    const collaborators = [{
      userId: 'cohost-1',
      email: 'cohost@example.com',
      ign: 'CoHost',
      role: 'co-host',
    }];
    const repositories = {
      members: {},
      shinies: {},
      users: {
        findById: jest.fn().mockResolvedValue(owner),
        findByEmailOrIgn: jest.fn().mockResolvedValue(collaborator),
      },
      catchEvents: {
        addCollaborator: jest.fn().mockResolvedValue(collaborators),
        removeCollaborator: jest.fn().mockResolvedValue([]),
      },
    };
    const app = createWorkerApp({ repositories });
    const token = jwt.sign({
      type: 'web_user',
      sub: 'owner-1',
      email: 'owner@example.com',
      ign: 'Owner',
    }, 'test-secret', { expiresIn: '14d' });

    const addResponse = await app.fetch(new Request('https://api.example.com/api/catch-events/event-1/collaborators', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({ identifier: 'CoHost' }),
    }), createEnv());
    const removeResponse = await app.fetch(new Request('https://api.example.com/api/catch-events/event-1/collaborators/cohost-1', {
      method: 'DELETE',
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
    }), createEnv());

    expect(addResponse.status).toBe(201);
    expect(removeResponse.status).toBe(200);
    expect(repositories.users.findByEmailOrIgn).toHaveBeenCalledWith('CoHost');
    expect(repositories.catchEvents.addCollaborator).toHaveBeenCalledWith('event-1', 'owner-1', collaborator);
    expect(repositories.catchEvents.removeCollaborator).toHaveBeenCalledWith('event-1', 'owner-1', 'cohost-1');
  });

  it('rejects missing shared-admin accounts and self-sharing', async () => {
    const owner = {
      id: 'owner-1',
      email: 'owner@example.com',
      ign: 'Owner',
      auth_provider: 'password',
    };
    const repositories = {
      members: {},
      shinies: {},
      users: {
        findById: jest.fn().mockResolvedValue(owner),
        findByEmailOrIgn: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(owner),
      },
      catchEvents: {
        addCollaborator: jest.fn()
          .mockImplementationOnce(() => {
            throw Object.assign(new Error('Owners already have access to their event.'), { code: 'SELF_COLLABORATOR' });
          }),
      },
    };
    const app = createWorkerApp({ repositories });
    const token = jwt.sign({
      type: 'web_user',
      sub: 'owner-1',
      email: 'owner@example.com',
      ign: 'Owner',
    }, 'test-secret', { expiresIn: '14d' });

    const missingResponse = await app.fetch(new Request('https://api.example.com/api/catch-events/event-1/collaborators', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({ identifier: 'missing@example.com' }),
    }), createEnv());
    const selfResponse = await app.fetch(new Request('https://api.example.com/api/catch-events/event-1/collaborators', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({ identifier: 'Owner' }),
    }), createEnv());

    expect(missingResponse.status).toBe(404);
    expect(selfResponse.status).toBe(400);
  });

  it('lets co-hosts view unpublished admin submissions and update operational controls', async () => {
    const cohost = {
      id: 'cohost-1',
      email: 'cohost@example.com',
      ign: 'CoHost',
      auth_provider: 'password',
    };
    const event = {
      id: 'event-1',
      ownerUserId: 'owner-1',
      name: 'Shared Event',
      isLeaderboardPublished: false,
      startLocal: '2026-05-23T01:00',
      endLocal: '2026-05-23T02:30',
      timezone: 'America/Los_Angeles',
      region: 'Sinnoh',
      route: 'Mt. Coronet',
      targets: ['Feebas'],
      speciesBonuses: [],
      speciesPenalties: [],
      natureBonuses: [],
      naturePenalties: [],
      autoCheckEnabled: false,
      submissions: [{ id: 'submission-1', eventId: 'event-1', playerIgn: 'Trainer' }],
    };
    const repositories = {
      members: {},
      shinies: {},
      users: {
        findById: jest.fn().mockResolvedValue(cohost),
      },
      catchEvents: {
        getEventById: jest.fn().mockResolvedValue(event),
        getEventAccess: jest.fn().mockResolvedValue({
          isOwner: false,
          isCollaborator: true,
          canManage: true,
        }),
        setSubmissionsClosed: jest.fn().mockResolvedValue({ ...event, submissionsClosed: true }),
        updateSubmission: jest.fn().mockResolvedValue({ ...event, submissions: [{ id: 'submission-1', score: 146 }] }),
      },
    };
    const app = createWorkerApp({ repositories });
    const token = jwt.sign({
      type: 'web_user',
      sub: 'cohost-1',
      email: 'cohost@example.com',
      ign: 'CoHost',
    }, 'test-secret', { expiresIn: '14d' });

    const viewResponse = await app.fetch(new Request('https://api.example.com/api/catch-events/event-1', {
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
    }), createEnv());
    const updateResponse = await app.fetch(new Request('https://api.example.com/api/catch-events/event-1/submissions-closed', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({ submissionsClosed: true }),
    }), createEnv());
    const editResponse = await app.fetch(new Request('https://api.example.com/api/catch-events/event-1/submissions/submission-1', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({
        playerIgn: 'Trainer',
        species: 'Feebas',
        nature: 'Docile',
        totalIv: 141,
        catchLocal: '2026-05-23T02:20:58',
        timezone: 'America/Los_Angeles',
        region: 'Sinnoh',
        route: 'Mt. Coronet',
      }),
    }), createEnv());
    const body = await viewResponse.json();

    expect(viewResponse.status).toBe(200);
    expect(body.data.submissions).toEqual(event.submissions);
    expect(updateResponse.status).toBe(200);
    expect(editResponse.status).toBe(200);
    expect(repositories.catchEvents.setSubmissionsClosed).toHaveBeenCalledWith('event-1', 'cohost-1', true);
    expect(repositories.catchEvents.updateSubmission).toHaveBeenCalledWith(
      'event-1',
      'cohost-1',
      'submission-1',
      expect.objectContaining({
        score: 141,
        status: 'pending-verification',
      })
    );
  });

  it('keeps owner-only catch event actions unavailable to co-hosts', async () => {
    const cohost = {
      id: 'cohost-1',
      email: 'cohost@example.com',
      ign: 'CoHost',
      auth_provider: 'password',
    };
    const repositories = {
      members: {},
      shinies: {},
      users: {
        findById: jest.fn().mockResolvedValue(cohost),
      },
      catchEvents: {
        deleteEvent: jest.fn().mockResolvedValue(null),
        listCollaborators: jest.fn().mockResolvedValue(null),
      },
    };
    const app = createWorkerApp({ repositories });
    const token = jwt.sign({
      type: 'web_user',
      sub: 'cohost-1',
      email: 'cohost@example.com',
      ign: 'CoHost',
    }, 'test-secret', { expiresIn: '14d' });

    const deleteResponse = await app.fetch(new Request('https://api.example.com/api/catch-events/event-1', {
      method: 'DELETE',
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
    }), createEnv());
    const shareResponse = await app.fetch(new Request('https://api.example.com/api/catch-events/event-1/collaborators', {
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
      },
    }), createEnv());

    expect(deleteResponse.status).toBe(404);
    expect(shareResponse.status).toBe(404);
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
    expect(response.headers.get('set-cookie')).toContain('Partitioned');
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

  it('serves Feebas WebSocket updates from the Worker repository contract', async () => {
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

    const response = await app.fetch(createWebSocketRequest('https://api.example.com/api/feebas/route-119-main/stream?actorFingerprint=client-12345678'), createEnv({
      LEGACY_API_BASE_URL: 'https://legacy.example.com',
    }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(repositories.feebas.getBoard).toHaveBeenCalledWith('route-119-main', {
      actorFingerprint: 'client-12345678',
      includeLeaderboard: false,
    });
    expect(response.status).toBe(101);
    expect(response.webSocket.received).toEqual([
      JSON.stringify({ success: true, data: board }),
    ]);
  });

  it('routes Feebas WebSocket upgrades through the Durable Object binding when available', async () => {
    const durableFetch = jest.fn().mockResolvedValue(new Response('durable stream', {
      headers: { upgrade: 'websocket' },
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
      createWebSocketRequest('https://api.example.com/api/feebas/route-119-main/stream?actorFingerprint=client-12345678'),
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
    expect(durableRequest.headers.get('upgrade')).toBe('websocket');
    expect(durableUrl.pathname).toBe('/stream');
    expect(durableUrl.searchParams.get('location')).toBe('route-119-main');
    expect(durableUrl.searchParams.get('actorFingerprint')).toBe('client-12345678');
  });

  it('broadcasts Feebas updates through the Durable Object binding when available', async () => {
    const activity = {
      id: 7,
      tileId: 'r1c7',
      tileLabel: 'G1',
      actionType: 'voted',
      previousStatus: 'unchecked',
      nextStatus: 'pending',
      actorName: 'Trainer',
      createdAt: '2026-04-09T20:20:00.000Z',
    };
    const board = {
      location: 'route-119-main',
      displayName: 'Route 119, Hoenn',
      cycleStart: '2026-04-09T20:15:00.000Z',
      cycleEnd: '2026-04-09T21:00:00.000Z',
      serverTime: '2026-04-09T20:20:00.000Z',
      tiles: [],
      activity: [activity],
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
    expect(durableUrl.searchParams.get('refresh')).toBe('1');
    expect(durableRequest.headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(await durableRequest.text())).toEqual({
      activityDelta: {
        actorFingerprint: 'client-12345678',
        data: {
          location: 'route-119-main',
          displayName: 'Route 119, Hoenn',
          cycleStart: '2026-04-09T20:15:00.000Z',
          cycleEnd: '2026-04-09T21:00:00.000Z',
          serverTime: '2026-04-09T20:20:00.000Z',
          activity: [activity],
        },
      },
    });
  });

  it('streams and broadcasts Feebas boards from the hibernating Durable Object class', async () => {
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
    const state = createDurableObjectState();
    const durableObject = new FeebasBoardStreamDurableObject(state, {}, {
      createRepositories: () => repositories,
    });

    const streamResponse = await durableObject.fetch(createWebSocketRequest('https://feebas-board-stream.local/stream?location=route-119-main&actorFingerprint=client-12345678'));

    const broadcastResponse = await durableObject.fetch(new Request('https://feebas-board-stream.local/broadcast?location=route-119-main', {
      method: 'POST',
    }));

    expect(streamResponse.status).toBe(101);
    expect(state.acceptWebSocket).toHaveBeenCalledTimes(1);
    expect(broadcastResponse.status).toBe(204);
    expect(repositories.feebas.getBoard).toHaveBeenNthCalledWith(1, 'route-119-main', {
      actorFingerprint: 'client-12345678',
      includeLeaderboard: false,
    });
    expect(repositories.feebas.getBoard).toHaveBeenNthCalledWith(2, 'route-119-main', {
      actorFingerprint: 'client-12345678',
      includeLeaderboard: false,
    });
    expect(streamResponse.webSocket.received).toEqual([
      JSON.stringify({ success: true, data: initialBoard }),
      JSON.stringify({ success: true, data: updatedBoard }),
    ]);
  });

  it('sends Feebas activity deltas before a Durable Object board refresh', async () => {
    const activity = {
      id: 7,
      tileId: 'r1c7',
      tileLabel: 'G1',
      actionType: 'voted',
      previousStatus: 'unchecked',
      nextStatus: 'pending',
      actorName: 'Trainer',
      createdAt: '2026-04-09T20:20:00.000Z',
    };
    const initialBoard = {
      location: 'route-119-main',
      displayName: 'Route 119, Hoenn',
      cycleEnd: '2026-04-09T21:00:00.000Z',
      tiles: [{ tileId: 'r1c7', status: 'unchecked' }],
      activity: [],
    };
    const updatedBoard = {
      ...initialBoard,
      serverTime: '2026-04-09T20:20:00.000Z',
      tiles: [{ tileId: 'r1c7', status: 'pending' }],
      activity: [activity],
    };
    const activityDelta = {
      actorFingerprint: 'client-12345678',
      data: {
        location: 'route-119-main',
        displayName: 'Route 119, Hoenn',
        cycleStart: '2026-04-09T20:15:00.000Z',
        cycleEnd: '2026-04-09T21:00:00.000Z',
        serverTime: '2026-04-09T20:20:00.000Z',
        activity: [activity],
      },
    };
    const repositories = {
      feebas: {
        getBoard: jest.fn().mockResolvedValue(initialBoard),
        getBoardCache: jest.fn().mockResolvedValue(updatedBoard),
        applyUserViewToBoardCache: jest.fn((board) => board),
      },
    };
    const state = createDurableObjectState();
    const durableObject = new FeebasBoardStreamDurableObject(state, {}, {
      createRepositories: () => repositories,
    });

    const writerStreamResponse = await durableObject.fetch(createWebSocketRequest('https://feebas-board-stream.local/stream?location=route-119-main&actorFingerprint=client-12345678'));
    const otherStreamResponse = await durableObject.fetch(createWebSocketRequest('https://feebas-board-stream.local/stream?location=route-119-main&actorFingerprint=client-87654321'));
    const broadcastResponse = await durableObject.fetch(new Request('https://feebas-board-stream.local/broadcast?location=route-119-main&refresh=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activityDelta }),
    }));

    expect(broadcastResponse.status).toBe(204);
    expect(repositories.feebas.getBoardCache).toHaveBeenCalledTimes(1);
    expect(writerStreamResponse.webSocket.received).toEqual([
      JSON.stringify({ success: true, data: initialBoard }),
      JSON.stringify({
        success: true,
        type: 'activity_delta',
        data: {
          ...activityDelta.data,
          isSelfNomination: true,
        },
      }),
      JSON.stringify({ success: true, data: updatedBoard }),
    ]);
    expect(otherStreamResponse.webSocket.received).toEqual([
      JSON.stringify({ success: true, data: initialBoard }),
      JSON.stringify({
        success: true,
        type: 'activity_delta',
        data: {
          ...activityDelta.data,
          isSelfNomination: false,
        },
      }),
      JSON.stringify({ success: true, data: updatedBoard }),
    ]);
  });

  it('forces a fresh Durable Object Feebas board broadcast after writes', async () => {
    const initialBoard = {
      location: 'route-119-main',
      tiles: [{ tileId: 'r1c7', status: 'unchecked' }],
      activity: [],
    };
    const cachedBoard = {
      location: 'route-119-main',
      tiles: [{ tileId: 'r1c7', status: 'checked' }],
      activity: [{ id: 1, tileId: 'r1c7', nextStatus: 'checked' }],
    };
    const freshBoard = {
      location: 'route-119-main',
      tiles: [{ tileId: 'r1c7', status: 'pending' }],
      activity: [{ id: 2, tileId: 'r1c7', nextStatus: 'pending' }],
    };
    const repositories = {
      feebas: {
        getBoard: jest.fn().mockResolvedValue(initialBoard),
        getBoardCache: jest.fn()
          .mockResolvedValueOnce(cachedBoard)
          .mockResolvedValueOnce(freshBoard),
        applyUserViewToBoardCache: jest.fn((board) => board),
      },
    };
    const state = createDurableObjectState();
    const durableObject = new FeebasBoardStreamDurableObject(state, {}, {
      createRepositories: () => repositories,
    });

    const streamResponse = await durableObject.fetch(createWebSocketRequest('https://feebas-board-stream.local/stream?location=route-119-main&actorFingerprint=client-12345678'));
    await durableObject.fetch(new Request('https://feebas-board-stream.local/broadcast?location=route-119-main', {
      method: 'POST',
    }));
    await durableObject.fetch(new Request('https://feebas-board-stream.local/broadcast?location=route-119-main', {
      method: 'POST',
    }));
    const refreshedBroadcastResponse = await durableObject.fetch(new Request('https://feebas-board-stream.local/broadcast?location=route-119-main&refresh=1', {
      method: 'POST',
    }));

    expect(refreshedBroadcastResponse.status).toBe(204);
    expect(repositories.feebas.getBoardCache).toHaveBeenCalledTimes(2);
    expect(streamResponse.webSocket.received).toEqual([
      JSON.stringify({ success: true, data: initialBoard }),
      JSON.stringify({ success: true, data: cachedBoard }),
      JSON.stringify({ success: true, data: cachedBoard }),
      JSON.stringify({ success: true, data: freshBoard }),
    ]);
  });

  it('coalesces overlapping non-forced Feebas board refresh broadcasts', async () => {
    const initialBoard = {
      location: 'route-119-main',
      tiles: [{ tileId: 'r1c7', status: 'unchecked' }],
      activity: [],
    };
    const freshBoard = {
      location: 'route-119-main',
      tiles: [{ tileId: 'r1c7', status: 'pending' }],
      activity: [{ id: 2, tileId: 'r1c7', nextStatus: 'pending' }],
    };
    let resolveBoardCache;
    const boardCachePromise = new Promise((resolve) => {
      resolveBoardCache = resolve;
    });
    const repositories = {
      feebas: {
        getBoard: jest.fn().mockResolvedValue(initialBoard),
        getBoardCache: jest.fn(() => boardCachePromise),
        applyUserViewToBoardCache: jest.fn((board) => board),
      },
    };
    const state = createDurableObjectState();
    const durableObject = new FeebasBoardStreamDurableObject(state, {}, {
      createRepositories: () => repositories,
    });

    const streamResponse = await durableObject.fetch(createWebSocketRequest('https://feebas-board-stream.local/stream?location=route-119-main&actorFingerprint=client-12345678'));
    const firstBroadcast = durableObject.fetch(new Request('https://feebas-board-stream.local/broadcast?location=route-119-main', {
      method: 'POST',
    }));
    const secondBroadcast = durableObject.fetch(new Request('https://feebas-board-stream.local/broadcast?location=route-119-main', {
      method: 'POST',
    }));

    expect(repositories.feebas.getBoardCache).toHaveBeenCalledTimes(1);
    resolveBoardCache(freshBoard);
    const [firstResponse, secondResponse] = await Promise.all([firstBroadcast, secondBroadcast]);

    expect(firstResponse.status).toBe(204);
    expect(secondResponse.status).toBe(204);
    expect(repositories.feebas.getBoardCache).toHaveBeenCalledTimes(1);
    expect(streamResponse.webSocket.received).toEqual([
      JSON.stringify({ success: true, data: initialBoard }),
      JSON.stringify({ success: true, data: freshBoard }),
      JSON.stringify({ success: true, data: freshBoard }),
    ]);
  });

  it('performs one follow-up refresh when a forced Feebas broadcast lands during an in-flight refresh', async () => {
    const initialBoard = {
      location: 'route-119-main',
      tiles: [{ tileId: 'r1c7', status: 'unchecked' }],
      activity: [],
    };
    const firstRefreshBoard = {
      location: 'route-119-main',
      tiles: [{ tileId: 'r1c7', status: 'checked' }],
      activity: [{ id: 1, tileId: 'r1c7', nextStatus: 'checked' }],
    };
    const followUpRefreshBoard = {
      location: 'route-119-main',
      tiles: [{ tileId: 'r1c7', status: 'pending' }],
      activity: [{ id: 2, tileId: 'r1c7', nextStatus: 'pending' }],
    };
    let resolveFirstRefresh;
    let resolveFollowUpRefresh;
    const firstRefreshPromise = new Promise((resolve) => {
      resolveFirstRefresh = resolve;
    });
    const followUpRefreshPromise = new Promise((resolve) => {
      resolveFollowUpRefresh = resolve;
    });
    const repositories = {
      feebas: {
        getBoard: jest.fn().mockResolvedValue(initialBoard),
        getBoardCache: jest.fn()
          .mockImplementationOnce(() => firstRefreshPromise)
          .mockImplementationOnce(() => followUpRefreshPromise),
        applyUserViewToBoardCache: jest.fn((board) => board),
      },
    };
    const state = createDurableObjectState();
    const durableObject = new FeebasBoardStreamDurableObject(state, {}, {
      createRepositories: () => repositories,
    });

    const streamResponse = await durableObject.fetch(createWebSocketRequest('https://feebas-board-stream.local/stream?location=route-119-main&actorFingerprint=client-12345678'));
    const firstBroadcast = durableObject.fetch(new Request('https://feebas-board-stream.local/broadcast?location=route-119-main&refresh=1', {
      method: 'POST',
    }));
    const secondBroadcast = durableObject.fetch(new Request('https://feebas-board-stream.local/broadcast?location=route-119-main&refresh=1', {
      method: 'POST',
    }));

    expect(repositories.feebas.getBoardCache).toHaveBeenCalledTimes(1);
    resolveFirstRefresh(firstRefreshBoard);
    const firstResponse = await firstBroadcast;

    expect(firstResponse.status).toBe(204);
    expect(repositories.feebas.getBoardCache).toHaveBeenCalledTimes(2);
    resolveFollowUpRefresh(followUpRefreshBoard);
    const secondResponse = await secondBroadcast;

    expect(secondResponse.status).toBe(204);
    expect(repositories.feebas.getBoardCache).toHaveBeenCalledTimes(2);
    expect(streamResponse.webSocket.received).toEqual([
      JSON.stringify({ success: true, data: initialBoard }),
      JSON.stringify({ success: true, data: firstRefreshBoard }),
      JSON.stringify({ success: true, data: followUpRefreshBoard }),
    ]);
  });

  it('broadcasts Feebas tile updates to Worker WebSocket subscribers', async () => {
    const activity = {
      id: 7,
      tileId: 'r1c7',
      tileLabel: 'G1',
      actionType: 'voted',
      previousStatus: 'unchecked',
      nextStatus: 'pending',
      actorName: 'Trainer',
      createdAt: '2026-04-09T20:20:00.000Z',
    };
    const initialBoard = {
      location: 'route-119-main',
      displayName: 'Route 119, Hoenn',
      cycleStart: '2026-04-09T20:15:00.000Z',
      cycleEnd: '2026-04-09T21:00:00.000Z',
      serverTime: '2026-04-09T20:19:00.000Z',
      tiles: [{ id: 'r1c7', status: 'unchecked' }],
      activity: [],
    };
    const updatedBoard = {
      location: 'route-119-main',
      displayName: 'Route 119, Hoenn',
      cycleStart: '2026-04-09T20:15:00.000Z',
      cycleEnd: '2026-04-09T21:00:00.000Z',
      serverTime: '2026-04-09T20:20:00.000Z',
      tiles: [{ id: 'r1c7', status: 'pending' }],
      activity: [activity],
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

    const streamResponse = await app.fetch(createWebSocketRequest('https://api.example.com/api/feebas/route-119-main/stream?actorFingerprint=client-12345678'), createEnv());

    await app.fetch(new Request('https://api.example.com/api/feebas/route-119-main/tiles/r1c7', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'pending',
        actorFingerprint: 'client-12345678',
        actorName: 'Trainer',
      }),
    }), createEnv());

    expect(repositories.feebas.getBoard).toHaveBeenLastCalledWith('route-119-main', {
      actorFingerprint: 'client-12345678',
      includeLeaderboard: false,
    });
    expect(streamResponse.webSocket.received).toEqual([
      JSON.stringify({ success: true, data: initialBoard }),
      JSON.stringify({
        success: true,
        type: 'activity_delta',
        data: {
          location: 'route-119-main',
          displayName: 'Route 119, Hoenn',
          cycleStart: '2026-04-09T20:15:00.000Z',
          cycleEnd: '2026-04-09T21:00:00.000Z',
          serverTime: '2026-04-09T20:20:00.000Z',
          activity: [activity],
          isSelfNomination: true,
        },
      }),
      JSON.stringify({ success: true, data: updatedBoard }),
    ]);
  });

  it('requires a WebSocket upgrade for Feebas live updates', async () => {
    const repositories = {
      members: {},
      shinies: {},
      users: {},
      feebas: {
        getBoard: jest.fn(),
      },
    };
    const app = createWorkerApp({ repositories });

    const response = await app.fetch(new Request('https://api.example.com/api/feebas/route-119-main/stream?actorFingerprint=client-12345678'), createEnv());
    const body = await response.json();

    expect(response.status).toBe(426);
    expect(response.headers.get('upgrade')).toBe('websocket');
    expect(body.message).toBe('Expected WebSocket upgrade');
    expect(repositories.feebas.getBoard).not.toHaveBeenCalled();
  });
});
