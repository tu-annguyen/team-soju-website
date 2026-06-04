const {
  DiscordInteractionContext,
  InteractionResponseType,
} = require('../src/discord/interactionContext');
const { MessageFlags } = require('../src/discord/api');

describe('DiscordInteractionContext', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(''),
    });
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('edits the original response when replying after a deferred chat command', async () => {
    const interaction = new DiscordInteractionContext({
      application_id: 'app-123',
      token: 'interaction-token',
      type: 2,
      data: { name: 'addshiny' },
      member: { user: { id: 'user-1' }, roles: [] },
    }, { DISCORD_CLIENT_ID: 'env-app-id' });

    await interaction.deferReply();
    await interaction.reply({ content: 'Finished.' });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://discord.com/api/v10/webhooks/app-123/interaction-token/messages/@original',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ content: 'Finished.' }),
      })
    );
  });

  it('stores an ephemeral deferred initial response when requested', async () => {
    const interaction = new DiscordInteractionContext({
      application_id: 'app-123',
      token: 'interaction-token',
      type: 2,
      data: { name: 'myshinies' },
      member: { user: { id: 'user-1' }, roles: [] },
    }, { DISCORD_CLIENT_ID: 'env-app-id' });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    expect(interaction.initialResponse).toEqual({
      type: InteractionResponseType.DeferredChannelMessageWithSource,
      data: { flags: MessageFlags.Ephemeral },
    });
  });

  it('stores a deferred message update response for component-backed modals', async () => {
    const interaction = new DiscordInteractionContext({
      application_id: 'app-123',
      token: 'interaction-token',
      type: 5,
      data: { custom_id: 'shm:advanced:encounters:selected-id' },
      member: { user: { id: 'user-1' }, roles: [] },
    }, { DISCORD_CLIENT_ID: 'env-app-id' });

    await interaction.deferUpdate();

    expect(interaction.initialResponse).toEqual({
      type: InteractionResponseType.DeferredUpdateMessage,
    });
  });

  it('captures the focused autocomplete option and responds with choices', async () => {
    const interaction = new DiscordInteractionContext({
      application_id: 'app-123',
      token: 'interaction-token',
      type: 4,
      data: {
        name: 'addshiny',
        options: [
          { name: 'pokemon', type: 3, value: 'char', focused: true },
        ],
      },
      member: { user: { id: 'user-1' }, roles: [] },
    }, { DISCORD_CLIENT_ID: 'env-app-id' });

    expect(interaction.isAutocomplete()).toBe(true);
    expect(interaction.options.getFocused()).toBe('char');
    expect(interaction.options.getFocusedOption()).toEqual(
      expect.objectContaining({ name: 'pokemon', value: 'char', focused: true })
    );

    await interaction.respondAutocomplete([{ name: 'Charizard', value: 'charizard' }]);

    expect(interaction.initialResponse).toEqual({
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: {
        choices: [{ name: 'Charizard', value: 'charizard' }],
      },
    });
  });

  it('retries transient Discord API failures before succeeding', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
        text: jest.fn().mockResolvedValue('upstream connect error'),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
        text: jest.fn().mockResolvedValue('upstream connect error'),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue(''),
      });

    const interaction = new DiscordInteractionContext({
      application_id: 'app-123',
      token: 'interaction-token',
      type: 2,
      data: { name: 'addshiny' },
      member: { user: { id: 'user-1' }, roles: [] },
    }, { DISCORD_CLIENT_ID: 'env-app-id' });

    await interaction.deferReply();
    await interaction.reply({ content: 'Finished.' });

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('throws a cleaner message when Discord remains unavailable', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: {
        get: jest.fn().mockReturnValue(null),
      },
      text: jest.fn().mockResolvedValue('upstream connect error'),
    });

    const interaction = new DiscordInteractionContext({
      application_id: 'app-123',
      token: 'interaction-token',
      type: 2,
      data: { name: 'addshiny' },
      member: { user: { id: 'user-1' }, roles: [] },
    }, { DISCORD_CLIENT_ID: 'env-app-id' });

    await interaction.deferReply();

    await expect(interaction.reply({ content: 'Finished.' })).rejects.toThrow(
      'Discord is temporarily unavailable (503), so the bot could not send its response. Please try again in a moment.'
    );
  });
});
