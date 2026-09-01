const REAL_DAY_DURATION_MS = 6 * 60 * 60 * 1000;
const REAL_MS_PER_GAME_MINUTE = REAL_DAY_DURATION_MS / (24 * 60);

// The July 31 reference falls on cycle index 0 modulo 7, so Saturday leads this sequence.
const WEEKDAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
const NATURAL_SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;

export type ShinyWarClockEvent = {
  starts_at: string;
  ends_at: string;
  seasons: string[];
  season_days?: number;
};

export type PokeMmoClockState = {
  time: string;
  timeOfDay: 'Morning' | 'Day' | 'Night';
  weekday: typeof WEEKDAYS[number];
  season: string;
};

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function getTimeOfDay(hour: number): PokeMmoClockState['timeOfDay'] {
  if (hour >= 4 && hour < 11) return 'Morning';
  if (hour >= 11 && hour < 21) return 'Day';
  return 'Night';
}

function getSeason(at: Date, event?: ShinyWarClockEvent) {
  const timestamp = at.getTime();
  const startsAt = event ? Date.parse(event.starts_at) : Number.NaN;
  const endsAt = event ? Date.parse(event.ends_at) : Number.NaN;

  if (event && timestamp >= startsAt && timestamp < endsAt && event.seasons.length > 0) {
    const seasonDuration = (event.season_days || 7) * 24 * 60 * 60 * 1000;
    const seasonIndex = Math.floor((timestamp - startsAt) / seasonDuration);
    return event.seasons[seasonIndex] || event.seasons[event.seasons.length - 1];
  }

  return NATURAL_SEASONS[at.getUTCMonth() % NATURAL_SEASONS.length];
}

export function getPokeMmoClockState(at: Date, event?: ShinyWarClockEvent): PokeMmoClockState {
  const timestamp = at.getTime();
  const dayIndex = Math.floor(timestamp / REAL_DAY_DURATION_MS);
  const elapsedInDay = positiveModulo(timestamp, REAL_DAY_DURATION_MS);
  const gameMinutes = Math.floor(elapsedInDay / REAL_MS_PER_GAME_MINUTE);
  const hour = Math.floor(gameMinutes / 60);
  const minute = gameMinutes % 60;

  return {
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    timeOfDay: getTimeOfDay(hour),
    weekday: WEEKDAYS[positiveModulo(dayIndex, WEEKDAYS.length)],
    season: getSeason(at, event),
  };
}
