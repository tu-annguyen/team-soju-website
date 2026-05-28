const fs = require('fs');
const path = require('path');
const { parseMobileStatsPanel } = require('../src/utils/mobileStatsParser');
const shiniesRouter = require('../src/express/routes/shinies');

function expectEncounterDigitMatch(actual, expected) {
  expect(Number.isInteger(actual)).toBe(true);
  expect(Number.isInteger(expected)).toBe(true);

  const actualText = String(actual);
  const expectedText = String(expected);

  expect(actualText.length).toBe(expectedText.length);
  expect(actualText[0]).toBe(expectedText[0]);
}

describe('mobile stats screenshot fixtures', () => {
  const { sharp, Tesseract } = shiniesRouter._test.loadOcrDependencies();
  const fixturesDir = path.join(__dirname, 'fixtures');
  let ocrWorker;

  beforeAll(async () => {
    ocrWorker = await shiniesRouter._test.createOcrWorker(Tesseract);
  }, 30000);

  afterAll(async () => {
    if (ocrWorker) {
      await ocrWorker.terminate();
    }
  });

  async function parseFixtureScreenshot({ fixture, expected }) {
    const imageBuffer = fs.readFileSync(path.join(fixturesDir, fixture));
    const { jobs } = await shiniesRouter._test.buildOcrJobs(imageBuffer, sharp);
    const ocrResults = [];

    for (const job of jobs) {
      const buffer = await job.bufferPromise;
      const result = await ocrWorker.recognize(buffer, job.options);
      ocrResults.push(result?.data?.text || '');
    }

    const ocrText = ocrResults.filter(Boolean).join('\n');
    const parsed = shiniesRouter._test.parseDataFromOcr(ocrText);
    const mobileStats = await parseMobileStatsPanel({
      imageBuffer,
      sharp,
      Tesseract: ocrWorker,
      existingNature: parsed.nature,
      pokemonName: expected.pokemon,
    });

    return {
      ocrText,
      parsed,
      mobileStats,
      merged: shiniesRouter._test.mergeParsedStats(parsed, mobileStats),
    };
  }

  const cases = [
    {
      fixture: 'pachirisu.png',
      expected: {
        pokemon: 'Pachirisu',
        trainer: 'Scotty',
        date: '2026-03-21',
        nature: 'Quiet',
        ivs: [12, 7, 31, 10, 29, 7],
        totalEncounters: 30973,
        speciesEncounters: 1984,
      },
    },
    {
      fixture: 'woobat.png',
      expected: {
        pokemon: 'Woobat',
        trainer: 'Pokio',
        date: '2026-03-21',
        nature: 'Naughty',
        ivs: [24, 21, 31, 19, 3, 1],
        totalEncounters: 27290,
        speciesEncounters: 2857,
      },
    },
    {
      fixture: 'liepard.png',
      expected: {
        pokemon: 'Liepard',
        trainer: 'YangXiaoLong',
        date: '2025-10-07',
        nature: 'Gentle',
        ivs: [19, 21, 17, 31, 11, 0],
        totalEncounters: 2144,
        speciesEncounters: 2100,
      },
    },
    {
      fixture: 'golett.png',
      expected: {
        pokemon: 'Golett',
        trainer: 'TMAvatar',
        date: '2026-03-07',
        nature: 'Quiet',
        ivs: [12, 17, 31, 7, 16, 21],
        totalEncounters: 13751,
        speciesEncounters: 4757,
      },
    },
    {
      fixture: 'sneasel.png',
      expected: {
        pokemon: 'Sneasel',
        trainer: 'Llensjo',
        date: '2026-03-16',
        nature: 'Naughty',
        ivs: [29, 10, 19, 22, 16, 31],
        totalEncounters: 12633,
        speciesEncounters: 1149,
      },
    },
  ];

  it.each(cases)(
    'parses $fixture with exact field checks and relaxed encounter checks',
    async ({ fixture, expected }) => {
      const { merged } = await parseFixtureScreenshot({ fixture, expected });

      expect(merged.name).toBe(expected.pokemon);
      expect(merged.trainer).toBe(expected.trainer);
      expect(merged.date).toBe(expected.date);
      expect(merged.nature).toBe(expected.nature);
      expect([merged.hp, merged.atk, merged.def, merged.spa, merged.spd, merged.spe]).toEqual(expected.ivs);
      expectEncounterDigitMatch(merged.totalEncounters, expected.totalEncounters);
      expectEncounterDigitMatch(merged.speciesEncounters, expected.speciesEncounters);
    },
    120000
  );
});
