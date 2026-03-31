import { getShinySpriteUrl } from '../src/utils/pokemonSprite';

describe('getShinySpriteUrl', () => {
  it('maps the frillish line gendered forms to PokemonDB slugs', () => {
    expect(getShinySpriteUrl('frillish')).toContain('/frillish-f.gif');
    expect(getShinySpriteUrl('frillish', 'frillish-male')).toContain('/frillish.gif');
    expect(getShinySpriteUrl('jellicent')).toContain('/jellicent-f.gif');
    expect(getShinySpriteUrl('jellicent', 'jellicent-male')).toContain('/jellicent.gif');
  });

  it('leaves other known form names unchanged', () => {
    expect(getShinySpriteUrl('basculin', 'basculin-red-striped')).toContain(
      '/basculin-red-striped.gif'
    );
    expect(getShinySpriteUrl('wormadam', 'wormadam-trash')).toContain('/wormadam-trash.gif');
  });
});
