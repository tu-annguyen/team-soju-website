const request = require('supertest');

describe('server CORS', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('allows production requests from Netlify preview origins', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'production' };
    const app = require('../src/server');

    const response = await request(app)
      .options('/api/feebas/route-119-main/tiles/r12c5')
      .set('Origin', 'https://team-soju-website.netlify.app')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://team-soju-website.netlify.app');
  });

  it('rejects untrusted production origins', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'production' };
    const app = require('../src/server');

    const response = await request(app)
      .options('/api/feebas/route-119-main/tiles/r12c5')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(500);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
