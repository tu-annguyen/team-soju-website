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
});
