const { COMMANDS } = require('../src/commands');

describe('commands', () => {
  it('enables autocomplete for the pokemon option on /addshiny', () => {
    const addShiny = COMMANDS.find(command => command.toJSON().name === 'addshiny');

    expect(addShiny).toBeDefined();

    const pokemonOption = addShiny.toJSON().options.find(option => option.name === 'pokemon');

    expect(pokemonOption).toEqual(expect.objectContaining({
      type: 3,
      name: 'pokemon',
      description: 'Pokemon name',
      required: true,
      autocomplete: true,
    }));
    expect(pokemonOption.choices).toBeUndefined();
  });

  it('does not include a variant slash option on /addshiny', () => {
    const addShiny = COMMANDS.find(command => command.toJSON().name === 'addshiny');

    expect(addShiny).toBeDefined();
    expect(addShiny.toJSON().options.find(option => option.name === 'variant')).toBeUndefined();
  });

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

  it('enables autocomplete for the pokemon option on /editshiny', () => {
    const editShiny = COMMANDS.find(command => command.toJSON().name === 'editshiny');

    expect(editShiny).toBeDefined();

    const pokemonOption = editShiny.toJSON().options.find(option => option.name === 'pokemon');

    expect(pokemonOption).toEqual(expect.objectContaining({
      type: 3,
      name: 'pokemon',
      description: 'Pokemon name',
      required: false,
      autocomplete: true,
    }));
    expect(pokemonOption.choices).toBeUndefined();
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
