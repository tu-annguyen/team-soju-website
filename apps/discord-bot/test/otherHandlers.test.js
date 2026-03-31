const { handleHelp } = require('../src/handlers/otherHandlers');

describe('handleHelp', () => {
  afterEach(() => {
    delete global.fetch;
  });

  it('falls back to plain slash commands when Discord command lookup is temporarily unavailable', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
        text: jest.fn().mockResolvedValue('upstream connect error'),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
        text: jest.fn().mockResolvedValue('upstream connect error'),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
        text: jest.fn().mockResolvedValue('upstream connect error'),
      });

    const interaction = {
      applicationId: 'app-123',
      raw: { guild_id: 'guild-123' },
      env: { DISCORD_TOKEN: 'bot-token' },
      deferReply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
    };

    await handleHelp(interaction);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: [expect.objectContaining({
        data: expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: 'Useful Commands',
              value: expect.stringContaining('/shinies'),
            }),
          ]),
        }),
      })],
    }));
  });
});
