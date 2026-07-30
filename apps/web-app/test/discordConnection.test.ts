import { getDiscordConnectionUrl } from '../src/auth/discordConnection';

describe('getDiscordConnectionUrl', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    // @ts-expect-error - tests provide the browser fetch implementation.
    global.fetch = fetchMock;
  });

  it('starts the connection with a credentialed fetch in the current cookie partition', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          authorizationUrl: 'https://discord.com/oauth2/authorize?client_id=discord-client',
        },
      }),
    });

    await expect(getDiscordConnectionUrl(
      'https://api.example.com/api/',
      '/tools/private?lang=en'
    )).resolves.toBe('https://discord.com/oauth2/authorize?client_id=discord-client');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/auth/discord?mode=connect&returnTo=%2Ftools%2Fprivate%3Flang%3Den',
      {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      }
    );
  });

  it('surfaces the API error when the session is unavailable', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        message: 'Sign in before connecting Discord.',
      }),
    });

    await expect(getDiscordConnectionUrl(
      'https://api.example.com/api',
      '/auth'
    )).rejects.toThrow('Sign in before connecting Discord.');
  });
});
