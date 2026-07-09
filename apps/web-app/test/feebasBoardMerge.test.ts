import { mergeFeebasBoardUpdate } from '../src/components/feebas-tile-checker/feebasBoardMerge';
import type { FeebasBoard, FeebasWeatherStatus } from '../src/components/feebas-tile-checker/shared';

const baseWeather: FeebasWeatherStatus = {
  areaId: 'route-119',
  dayStart: '2026-06-30T00:00:00.000Z',
  dayEnd: '2026-06-30T06:00:00.000Z',
  nextPossibleChangeAt: '2026-06-30T06:00:00.000Z',
  minimumCyclesUntilPossibleChange: 8,
  confirmed: null,
  pending: [],
  currentUserVote: null,
};

function buildBoard(weather: FeebasWeatherStatus, overrides: Partial<FeebasBoard> = {}): FeebasBoard {
  return {
    location: 'route-119-main',
    displayName: 'Route 119, Hoenn',
    description: 'Main Route 119 pond tiles for live Feebas coordination.',
    cycleStart: '2026-06-30T00:00:00.000Z',
    cycleEnd: '2026-06-30T00:45:00.000Z',
    serverTime: '2026-06-30T00:20:00.000Z',
    resetIntervalMinutes: 45,
    requiresDistinctConfirmation: false,
    confirmedTileId: null,
    isLocked: false,
    previousConfirmedTiles: [],
    layout: {
      rows: 2,
      cols: 2,
    },
    activity: [],
    weather,
    tiles: [],
    ...overrides,
  };
}

describe('mergeFeebasBoardUpdate', () => {
  it('keeps a newer same-day weather confirmation over an older board snapshot', () => {
    const currentBoard = buildBoard({
      ...baseWeather,
      confirmed: {
        weather: 'clear',
        actorName: 'Brendan',
        reportedAt: '2026-06-30T00:10:00.000Z',
        confirmedAt: '2026-06-30T00:12:00.000Z',
        confirmations: 2,
      },
      currentUserVote: 'clear',
    });
    const olderBoard = buildBoard({
      ...baseWeather,
      confirmed: {
        weather: 'rainy',
        actorName: 'May',
        reportedAt: '2026-06-30T00:05:00.000Z',
        confirmedAt: '2026-06-30T00:08:00.000Z',
        confirmations: 2,
      },
      currentUserVote: 'rainy',
    });

    const mergedBoard = mergeFeebasBoardUpdate(currentBoard, olderBoard);

    expect(mergedBoard.weather?.confirmed?.weather).toBe('clear');
    expect(mergedBoard.weather?.confirmed?.confirmedAt).toBe('2026-06-30T00:12:00.000Z');
    expect(mergedBoard.weather?.currentUserVote).toBe('clear');
  });

  it('keeps fresher same-day weather when the board cycle changes', () => {
    const currentBoard = buildBoard({
      ...baseWeather,
      confirmed: {
        weather: 'clear',
        actorName: 'Brendan',
        reportedAt: '2026-06-30T00:10:00.000Z',
        confirmedAt: '2026-06-30T00:12:00.000Z',
        confirmations: 2,
      },
    }, {
      cycleEnd: '2026-06-30T01:30:00.000Z',
    });
    const olderBoard = buildBoard({
      ...baseWeather,
      confirmed: {
        weather: 'rainy',
        actorName: 'May',
        reportedAt: '2026-06-30T00:05:00.000Z',
        confirmedAt: '2026-06-30T00:08:00.000Z',
        confirmations: 2,
      },
    }, {
      cycleEnd: '2026-06-30T02:15:00.000Z',
    });

    const mergedBoard = mergeFeebasBoardUpdate(currentBoard, olderBoard);

    expect(mergedBoard.cycleEnd).toBe('2026-06-30T02:15:00.000Z');
    expect(mergedBoard.weather?.confirmed?.weather).toBe('clear');
  });

  it('accepts a weather status from a new PokeMMO day', () => {
    const currentBoard = buildBoard({
      ...baseWeather,
      confirmed: {
        weather: 'clear',
        actorName: 'Brendan',
        reportedAt: '2026-06-30T00:10:00.000Z',
        confirmedAt: '2026-06-30T00:12:00.000Z',
        confirmations: 2,
      },
    });
    const nextDayBoard = buildBoard({
      ...baseWeather,
      dayStart: '2026-06-30T06:00:00.000Z',
      dayEnd: '2026-06-30T12:00:00.000Z',
      nextPossibleChangeAt: '2026-06-30T12:00:00.000Z',
      confirmed: null,
      currentUserVote: null,
    });

    const mergedBoard = mergeFeebasBoardUpdate(currentBoard, nextDayBoard);

    expect(mergedBoard.weather?.dayStart).toBe('2026-06-30T06:00:00.000Z');
    expect(mergedBoard.weather?.confirmed).toBeNull();
  });
});
