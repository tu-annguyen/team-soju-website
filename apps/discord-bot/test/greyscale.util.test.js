const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');

const { greyscale } = require('@team-soju/utils');

jest.mock('axios');

describe('greyscale util', () => {
  it('converts a static PNG to greyscale', async () => {
    // create a tiny colored PNG
    const colorPng = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 10, g: 20, b: 30 } }
    })
      .png()
      .toBuffer();

    axios.get.mockResolvedValueOnce({ data: colorPng });

    const output = await greyscale('http://example.com/static.png');
    const { data, info } = await sharp(output)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // first pixel should have equal RGB components (greyscale) and not be all zero
    expect(data[0]).toBe(data[1]);
    expect(data[0]).toBe(data[2]);
    expect(data[0]).toBeGreaterThan(0);
  });

  it('converts an animated GIF to greyscale and keeps pages', async () => {
    const b64 = fs.readFileSync(path.join(__dirname, 'fixtures', 'animated.gif'), 'utf8');
    const gifBuf = Buffer.from(b64, 'base64');
    axios.get.mockResolvedValueOnce({ data: gifBuf });

    const output = await greyscale('http://example.com/anim.gif');
    const { data, info } = await sharp(output, { animated: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    expect(info.format).toBe('raw');
    expect(info.pages).toBeGreaterThan(1);

    // sample first non-transparent pixel (0,0) of first frame
    const w = info.width;
    const c = info.channels;
    const idx = (0 * w + 0) * c;
    expect(data[idx]).toBe(data[idx + 1]);
    expect(data[idx]).toBe(data[idx + 2]);
  });
});
