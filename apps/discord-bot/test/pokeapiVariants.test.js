const {
  filterEntriesToGenerationV,
  isGenerationVOrEarlierVersionGroup,
} = require('../../../packages/utils/variant-filter.cjs');

describe('variant generation filtering', () => {
  it('filters forms introduced after Generation V even when Gen V sprite fields exist', async () => {
    const hasGenerationVSpriteForName = jest.fn().mockResolvedValue(true);
    const entries = [
      {
        value: 'meowth',
        introduced_in_version_group: 'red-green-japan',
      },
      {
        value: 'meowth-alola',
        introduced_in_version_group: 'sun-moon',
      },
      {
        value: 'meowth-galar',
        introduced_in_version_group: 'sword-shield',
      },
      {
        value: 'meowth-gmax',
        introduced_in_version_group: 'sword-shield',
      },
    ];

    await expect(filterEntriesToGenerationV(entries, {
      speciesName: 'meowth',
      hasGenerationVSpriteForName,
    })).resolves.toEqual([entries[0]]);
    expect(hasGenerationVSpriteForName).toHaveBeenCalledWith('meowth');
    expect(hasGenerationVSpriteForName).not.toHaveBeenCalledWith('meowth-alola');
  });

  it('keeps version groups from Generation V and before', () => {
    expect(isGenerationVOrEarlierVersionGroup('black-white')).toBe(true);
    expect(isGenerationVOrEarlierVersionGroup('diamond-pearl')).toBe(true);
    expect(isGenerationVOrEarlierVersionGroup('red-green-japan')).toBe(true);
    expect(isGenerationVOrEarlierVersionGroup('sun-moon')).toBe(false);
  });
});
