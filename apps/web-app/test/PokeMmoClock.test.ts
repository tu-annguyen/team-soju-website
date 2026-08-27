import { getPokeMmoClockState, type ShinyWarClockEvent } from '../src/components/shiny-war/pokeMmoClockState';

const event: ShinyWarClockEvent = {
  starts_at: '2026-08-01T00:00:00.000Z',
  ends_at: '2026-08-29T00:00:00.000Z',
  seasons: ['Summer', 'Autumn', 'Winter', 'Spring'],
  season_days: 7,
};

describe('PokeMMO clock', () => {
  it('matches the observed Saturday morning clock and natural season', () => {
    expect(getPokeMmoClockState(new Date('2026-07-31T19:10:15.000Z'), event)).toEqual({
      time: '04:41',
      timeOfDay: 'Morning',
      weekday: 'Saturday',
      season: 'Autumn',
    });
  });

  it.each([
    ['2026-08-01T00:00:00.000Z', 'Summer'],
    ['2026-08-08T00:00:00.000Z', 'Autumn'],
    ['2026-08-15T00:00:00.000Z', 'Winter'],
    ['2026-08-22T00:00:00.000Z', 'Spring'],
  ])('uses the weekly event season at %s', (timestamp, season) => {
    expect(getPokeMmoClockState(new Date(timestamp), event).season).toBe(season);
  });

  it('changes time-of-day at the PokeMMO boundaries', () => {
    expect(getPokeMmoClockState(new Date('2026-08-01T01:00:00.000Z'), event).timeOfDay).toBe('Morning');
    expect(getPokeMmoClockState(new Date('2026-08-01T02:45:00.000Z'), event).timeOfDay).toBe('Day');
    expect(getPokeMmoClockState(new Date('2026-08-01T05:15:00.000Z'), event).timeOfDay).toBe('Night');
  });
});
