const jwt = require('jsonwebtoken');

const {
  AUTH_COOKIE_NAME,
  authenticateBot,
  generateBotToken,
  parseCookies,
  requireUser,
  setAuthCookie,
  signUserToken,
} = require('../src/middleware/auth');

describe('generateBotToken', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, JWT_SECRET: 'test-secret' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns a signed token that can be verified', () => {
    const token = generateBotToken();
    const decoded = jwt.verify(token, 'test-secret');

    expect(decoded.type).toBe('discord_bot');
    expect(Array.isArray(decoded.permissions)).toBe(true);
    expect(decoded.permissions).toContain('read');
  });
});

describe('authenticateBot middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, JWT_SECRET: 'test-secret' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createResponse = () => {
    const res = {};

    res.statusCode = 200;
    res.status = code => {
      res.statusCode = code;
      return res;
    };
    res.body = null;
    res.json = body => {
      res.body = body;
      return res;
    };

    return res;
  };

  it('rejects when no Authorization header is provided', () => {
    const req = {
      header: jest.fn().mockReturnValue(undefined)
    };
    const res = createResponse();
    const next = jest.fn();

    authenticateBot(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and sets req.bot for a valid bot token', () => {
    const token = jwt.sign({ type: 'discord_bot', id: 'bot-id' }, 'test-secret');
    const req = {
      header: jest.fn().mockReturnValue(`Bearer ${token}`)
    };
    const res = createResponse();
    const next = jest.fn();

    authenticateBot(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.bot).toBeDefined();
  });

  it('rejects non-bot tokens', () => {
    const token = jwt.sign({ id: 'bot-id' }, 'test-secret');
    const req = {
      header: jest.fn().mockReturnValue(`Bearer ${token}`)
    };
    const res = createResponse();
    const next = jest.fn();

    authenticateBot(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid token', () => {
    const req = {
      header: jest.fn().mockReturnValue('Bearer invalid-token')
    };
    const res = createResponse();
    const next = jest.fn();

    authenticateBot(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('web user auth helpers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, JWT_SECRET: 'test-secret', NODE_ENV: 'development' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createResponse = () => ({
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    body: null,
    json(body) {
      this.body = body;
      return this;
    },
  });

  it('serializes an auth cookie for signed-in users', () => {
    const res = createResponse();
    const token = signUserToken({ id: 'user-id', email: 'a@example.com', ign: 'Trainer' });

    setAuthCookie(res, token);

    expect(res.headers['Set-Cookie']).toContain(`${AUTH_COOKIE_NAME}=`);
    expect(res.headers['Set-Cookie']).toContain('HttpOnly');
    expect(res.headers['Set-Cookie']).toContain('SameSite=Lax');
  });

  it('marks production cross-site auth cookies as partitioned for Chrome mobile persistence', () => {
    process.env.NODE_ENV = 'production';

    const res = createResponse();
    const token = signUserToken({ id: 'user-id', email: 'a@example.com', ign: 'Trainer' });

    setAuthCookie(res, token);

    expect(res.headers['Set-Cookie']).toContain('Secure');
    expect(res.headers['Set-Cookie']).toContain('SameSite=None');
    expect(res.headers['Set-Cookie']).toContain('Partitioned');
  });

  it('parses cookies from a request header', () => {
    expect(parseCookies('a=one; team_soju_session=token-value')).toEqual({
      a: 'one',
      team_soju_session: 'token-value',
    });
  });

  it('loads a valid user token from cookies', () => {
    const token = signUserToken({ id: 'user-id', email: 'a@example.com', ign: 'Trainer' });
    const req = {
      header: jest.fn((name) => (name === 'Cookie' ? `${AUTH_COOKIE_NAME}=${token}` : undefined)),
    };
    const res = createResponse();
    const next = jest.fn();

    requireUser(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.sub).toBe('user-id');
  });

  it('rejects missing user sessions', () => {
    const req = {
      header: jest.fn().mockReturnValue(undefined),
    };
    const res = createResponse();
    const next = jest.fn();

    requireUser(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });
});
