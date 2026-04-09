const fetchClient = require('../src/fetchClient');

describe('fetchClient', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retries retryable upstream 502 responses and eventually succeeds', async () => {
    global.fetch
      .mockResolvedValueOnce(new Response('Bad Gateway', { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

    const response = await fetchClient.get('https://example.com/api/test');

    expect(response).toEqual({ data: { data: { ok: true } } });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('retries aborted requests up to the configured limit', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    global.fetch
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

    const response = await fetchClient.get('https://example.com/api/test', { maxRetries: 1 });

    expect(response).toEqual({ data: { data: { ok: true } } });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable 400 responses', async () => {
    global.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Bad request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(fetchClient.get('https://example.com/api/test')).rejects.toMatchObject({
      message: 'Bad request',
      response: {
        status: 400,
      },
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
