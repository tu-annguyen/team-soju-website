const { MessageFlags } = require('../src/discord/api');
const { getAutoDeferredReplyOptions } = require('../src/worker');

describe('worker auto defer options', () => {
  it('marks myshinies as ephemeral', () => {
    expect(getAutoDeferredReplyOptions('myshinies')).toEqual({
      flags: MessageFlags.Ephemeral,
    });
  });

  it('marks help as ephemeral', () => {
    expect(getAutoDeferredReplyOptions('help')).toEqual({
      flags: MessageFlags.Ephemeral,
    });
  });

  it('defaults other commands to a public deferred response', () => {
    expect(getAutoDeferredReplyOptions('addshiny')).toEqual({});
  });
});
