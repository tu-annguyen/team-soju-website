const { COMMANDS } = require('../src/commands');

describe('commands', () => {
  it('includes a variant option on /editshiny', () => {
    const editShiny = COMMANDS.find(command => command.toJSON().name === 'editshiny');

    expect(editShiny).toBeDefined();

    const variantOption = editShiny.toJSON().options.find(option => option.name === 'variant');

    expect(variantOption).toEqual(expect.objectContaining({
      type: 3,
      name: 'variant',
      description: 'Pokemon variant slug',
      required: false,
    }));
  });
});
