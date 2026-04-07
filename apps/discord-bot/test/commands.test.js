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

  it('caps /shinies limit at 25', () => {
    const shinies = COMMANDS.find(command => command.toJSON().name === 'shinies');

    expect(shinies).toBeDefined();

    const limitOption = shinies.toJSON().options.find(option => option.name === 'limit');

    expect(limitOption).toEqual(expect.objectContaining({
      type: 4,
      name: 'limit',
      min_value: 1,
      max_value: 25,
    }));
  });

  it('caps /myshinies limit at 25', () => {
    const myShinies = COMMANDS.find(command => command.toJSON().name === 'myshinies');

    expect(myShinies).toBeDefined();

    const limitOption = myShinies.toJSON().options.find(option => option.name === 'limit');

    expect(limitOption).toEqual(expect.objectContaining({
      type: 4,
      name: 'limit',
      min_value: 1,
      max_value: 25,
    }));
  });
});
