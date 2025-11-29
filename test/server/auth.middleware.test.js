const jwt = require('jsonwebtoken');

const { authenticateBot, generateBotToken } = require('../../server/src/middleware/auth');

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

  it('calls next and sets req.bot for a valid token', () => {
    const token = jwt.sign({ id: 'bot-id' }, 'test-secret');
    const req = {
      header: jest.fn().mockReturnValue(`Bearer ${token}`)
    };
    const res = createResponse();
    const next = jest.fn();

    authenticateBot(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.bot).toBeDefined();
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
