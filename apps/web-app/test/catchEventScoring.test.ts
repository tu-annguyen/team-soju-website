import {
  CatchEventConfig,
  CatchEventSubmission,
  calculateCatchEventScore,
  parseRuleLines,
  rankCatchEventSubmissions,
  selectCatchEventWinners,
  validateCatchEventSubmission,
  zonedLocalDateTimeToUtc,
} from '../src/utils/catchEventScoring';

const eventFixture: CatchEventConfig = {
  id: 'little-vamp',
  name: 'Little Vamp in Zone, Watch Out!',
  ownerUserId: 'user-id',
  ownerIgn: 'tunacore',
  eventDate: '2026-05-19',
  startLocal: '2026-05-19T15:00',
  endLocal: '2026-05-19T16:00',
  timezone: 'America/New_York',
  winnerCount: 4,
  targets: ['Zubat', 'Golbat'],
  speciesBonuses: [{ name: 'Zubat', points: 3 }],
  speciesPenalties: [],
  natureBonuses: [{ name: 'Jolly', points: 5 }],
  naturePenalties: [{ name: 'Quiet', points: -3 }],
  useLowestScoreFinalPlace: true,
  isLeaderboardPublished: false,
  createdAt: '2026-05-14T00:00:00.000Z',
};

function makeSubmission(
  id: string,
  score: number,
  catchUtc: string,
  status: CatchEventSubmission['status'] = 'valid'
): CatchEventSubmission {
  return {
    id,
    eventId: eventFixture.id,
    playerIgn: id,
    species: 'Zubat',
    nature: 'Jolly',
    totalIv: score,
    catchLocal: '2026-05-19T15:15',
    timezone: 'America/New_York',
    screenshotNames: ['summary.png'],
    score,
    catchUtc,
    flags: [],
    status,
    createdAt: '2026-05-14T00:00:00.000Z',
  };
}

describe('catch event scoring', () => {
  it('parses bonus rules and calculates species, nature, and penalty points', () => {
    const speciesBonuses = parseRuleLines('Zubat: +3\nGolbat: +1');
    const naturePenalties = parseRuleLines('Quiet: -3');

    expect(speciesBonuses).toEqual([
      { name: 'Zubat', points: 3 },
      { name: 'Golbat', points: 1 },
    ]);
    expect(naturePenalties).toEqual([{ name: 'Quiet', points: -3 }]);
    expect(
      calculateCatchEventScore(
        {
          species: 'Zubat',
          nature: 'Jolly',
          totalIv: 140,
        },
        eventFixture
      )
    ).toBe(148);
    expect(
      calculateCatchEventScore(
        {
          species: 'Zubat',
          nature: 'Quiet',
          totalIv: 140,
        },
        eventFixture
      )
    ).toBe(140);
    expect(
      calculateCatchEventScore(
        {
          species: 'Golbat',
          nature: 'Bold',
          totalIv: 140,
        },
        {
          ...eventFixture,
          speciesPenalties: [{ name: 'Golbat', points: -2 }],
        }
      )
    ).toBe(138);
  });

  it('normalizes a player-local catch time into UTC', () => {
    expect(zonedLocalDateTimeToUtc('2026-04-12T23:31:35', 'America/Los_Angeles')).toBe(
      '2026-04-13T06:31:35.000Z'
    );
  });

  it('flags invalid or suspicious submissions for review', () => {
    const result = validateCatchEventSubmission(
      {
        playerIgn: 'tunacore',
        species: 'Milotic',
        nature: 'Bold',
        totalIv: 187,
        catchLocal: '2026-05-19T14:59',
        timezone: 'America/Los_Angeles',
        screenshotNames: [],
      },
      eventFixture,
      'America/New_York'
    );

    expect(result.status).toBe('needs-review');
    expect(result.flags).toEqual(
      expect.arrayContaining([
        'Species is not allowed for this event',
        'Total IV must be between 0 and 186',
        'No screenshots attached',
        'Timezone differs from browser-detected timezone',
        'Catch time is outside the event window',
      ])
    );
  });

  it('ranks by highest score with earliest catch time as the tie-break', () => {
    const ranked = rankCatchEventSubmissions([
      makeSubmission('later', 166, '2026-05-19T19:09:10.000Z'),
      makeSubmission('earlier', 166, '2026-05-19T19:04:44.000Z'),
      makeSubmission('winner', 168, '2026-05-19T19:12:04.000Z'),
      makeSubmission('ignored', 180, '2026-05-19T19:01:00.000Z', 'invalid'),
    ]);

    expect(ranked.map((submission) => submission.id)).toEqual(['winner', 'earlier', 'later']);
  });

  it('reserves the final configured winner slot for lowest score when enabled', () => {
    const winners = selectCatchEventWinners(eventFixture, [
      makeSubmission('first', 168, '2026-05-19T19:12:04.000Z'),
      makeSubmission('second', 166, '2026-05-19T19:04:44.000Z'),
      makeSubmission('third', 166, '2026-05-19T19:09:10.000Z'),
      makeSubmission('low', 23, '2026-05-19T19:51:23.000Z'),
      makeSubmission('middle', 140, '2026-05-19T19:20:00.000Z'),
    ]);

    expect(winners.map((submission) => submission.id)).toEqual([
      'first',
      'second',
      'third',
      'low',
    ]);
  });
});
