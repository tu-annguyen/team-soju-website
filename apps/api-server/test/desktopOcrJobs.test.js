const shiniesRouter = require('../src/routes/shinies');

describe('desktop OCR jobs', () => {
  it('adds targeted desktop OCR passes for header, main text, and stats', async () => {
    const { sharp } = shiniesRouter._test.loadOcrDependencies();
    const imageBuffer = await sharp({
      create: {
        width: 508,
        height: 568,
        channels: 3,
        background: { r: 32, g: 36, b: 40 },
      },
    }).png().toBuffer();

    const { layout, jobs } = await shiniesRouter._test.buildOcrJobs(imageBuffer, sharp);

    expect(layout).toBe('desktop');
    expect(jobs.map((job) => job.name)).toEqual([
      'desktop-header',
      'desktop-main-color-safe',
      'desktop-main-threshold',
      'desktop-stats-threshold',
      'desktop-stats',
    ]);
  });
});
