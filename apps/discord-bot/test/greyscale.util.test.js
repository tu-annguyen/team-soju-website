const sharp = require('sharp');
const { GifCodec, GifFrame } = require('gifwrap');

const { greyscale } = require('@team-soju/utils');

describe('greyscale util', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('converts a gif to greyscale', async () => {
    const gifBuffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');

    global.fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => gifBuffer,
    });

    const output = await greyscale('http://example.com/static.png');
    const { data } = await sharp(output, { animated: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    expect(data[0]).toBe(data[1]);
    expect(data[0]).toBe(data[2]);
    expect(data[0]).toBeGreaterThan(0);
  });

  it('preserves animation frames for animated gifs', async () => {
    const codec = new GifCodec();
    const animatedGif = await codec.encodeGif([
      new GifFrame(1, 1, 0xff0000ff, { delayCentisecs: 10 }),
      new GifFrame(1, 1, 0x00ff00ff, { delayCentisecs: 20 }),
    ], { loops: 0 });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => animatedGif.buffer,
    });

    const output = await greyscale('http://example.com/animated.gif');
    const metadata = await sharp(output, { animated: true }).metadata();

    expect(metadata.format).toBe('gif');
    expect(metadata.pages).toBe(2);
  });

  it('throws when the image request fails', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(greyscale('http://example.com/fail.png')).rejects.toThrow('HTTP error');
  });
});
