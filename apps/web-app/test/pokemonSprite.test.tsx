import { getShinySpriteUrl } from '../src/utils/pokemonSprite';

describe('getShinySpriteUrl', () => {
  it('uses the base shiny sprite for default and male variants', () => {
    expect(getShinySpriteUrl(592)).toContain('/592.gif');
    expect(getShinySpriteUrl(592, 'frillish-male')).toContain('/592.gif');
    expect(getShinySpriteUrl(593)).toContain('/593.gif');
    expect(getShinySpriteUrl(593, 'jellicent-male')).toContain('/593.gif');
  });

  it('maps female and form variants to the pokeapi sprite paths', () => {
    expect(getShinySpriteUrl(592, 'frillish')).toContain('/592.gif');
    expect(getShinySpriteUrl(592, 'frillish-female')).toContain('/female/592.gif');
    expect(getShinySpriteUrl(550, 'basculin-red-striped')).toContain('/550-red-striped.gif');
    expect(getShinySpriteUrl(413, 'wormadam-trash')).toContain('/413-trash.gif');
  });

  it('returns an empty string when the dex number is missing', () => {
    expect(getShinySpriteUrl(null, 'wormadam-trash')).toBe('');
  });
});
