jest.mock('@team-soju/utils', () => ({
  getPokemonVariants: jest.fn(),
  getSpriteUrl: jest.fn(),
}));

const { getPokemonVariants, getSpriteUrl } = require('@team-soju/utils');
const { getGreyscaleSprite } = require('../src/cloudflare/services/shiny-assets');

describe('Worker grayscale sprites', () => {
  beforeEach(() => {
    getPokemonVariants.mockResolvedValue({ variants: ['deerling-spring'] });
    getSpriteUrl.mockResolvedValue('https://raw.githubusercontent.com/PokeAPI/sprites/pikachu.gif');
  });

  it('uses the free animated saturation transformation for canonical variants', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response('gray', { headers: { 'content-type': 'image/gif' } }));
    const response = await getGreyscaleSprite({ nationalNumber: 585, variant: 'deerling-spring', fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith(expect.any(String), { cf: { image: { saturation: 0, anim: true } } });
    expect(await response.text()).toBe('gray');
    expect(response.headers.get('cache-control')).toBe('public, max-age=86400');
  });

  it('falls back to the original color GIF when transformation is unavailable', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(new Response('quota', { status: 429 }))
      .mockResolvedValueOnce(new Response('color', { headers: { 'content-type': 'image/gif' } }));
    const response = await getGreyscaleSprite({ nationalNumber: 25, fetchImpl });
    expect(await response.text()).toBe('color');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects non-canonical variants without spending a transformation', async () => {
    const fetchImpl = jest.fn();
    const response = await getGreyscaleSprite({ nationalNumber: 585, variant: 'invented-form', fetchImpl });
    expect(response).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
