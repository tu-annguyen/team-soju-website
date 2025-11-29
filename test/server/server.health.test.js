const request = require('supertest');

const app = require('../../server/src/server');

describe('Health endpoint', () => {
  it('returns 200 and expected body', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Team Soju API is running');
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('returns 404 for unknown route', async () => {
    const response = await request(app).get('/non-existent-path');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Endpoint not found');
  });
});

describe('/generate-bot-token endpoint', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'development', JWT_SECRET: 'test-secret' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns a token in non-production', async () => {
    const response = await request(app).get('/generate-bot-token');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.token).toBe('string');
  });

  it('is forbidden in production', async () => {
    process.env.NODE_ENV = 'production';

    const response = await request(app).get('/generate-bot-token');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});
