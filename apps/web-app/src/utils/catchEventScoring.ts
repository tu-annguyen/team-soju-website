export type CatchEventStatus = 'valid' | 'needs-review' | 'invalid' | 'disqualified';

export type CatchEventRule = {
  name: string;
  points: number;
};

export type CatchEventConfig = {
  id: string;
  name: string;
  ownerUserId?: string | null;
  ownerIgn?: string | null;
  eventDate: string;
  startLocal: string;
  endLocal: string;
  timezone: string;
  winnerCount: number;
  targets: string[];
  speciesBonuses: CatchEventRule[];
  speciesPenalties: CatchEventRule[];
  natureBonuses: CatchEventRule[];
  naturePenalties: CatchEventRule[];
  useLowestScoreFinalPlace: boolean;
  isLeaderboardPublished: boolean;
  createdAt: string;
};

export type CatchEventSubmissionInput = {
  playerIgn: string;
  species: string;
  nature: string;
  totalIv: number;
  catchLocal: string;
  timezone: string;
  screenshotNames: string[];
  screenshotProofs?: {
    name: string;
    dataUrl: string;
  }[];
};

export type CatchEventSubmission = CatchEventSubmissionInput & {
  id: string;
  eventId: string;
  status: CatchEventStatus;
  score: number;
  catchUtc: string;
  flags: string[];
  createdAt: string;
};

export type RankedCatchEventSubmission = CatchEventSubmission & {
  rank: number;
};

export const POKEMON_NATURES = [
  'Hardy',
  'Lonely',
  'Brave',
  'Adamant',
  'Naughty',
  'Bold',
  'Docile',
  'Relaxed',
  'Impish',
  'Lax',
  'Timid',
  'Hasty',
  'Serious',
  'Jolly',
  'Naive',
  'Modest',
  'Mild',
  'Quiet',
  'Bashful',
  'Rash',
  'Calm',
  'Gentle',
  'Sassy',
  'Careful',
  'Quirky',
] as const;

const natureSet = new Set<string>(POKEMON_NATURES.map((nature) => nature.toLowerCase()));

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

export function slugifyEventName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || `catch-event-${Date.now()}`;
}

export function parseRuleLines(value: string): CatchEventRule[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)(?:\s*[: ,]\s*|\s+)([-+]?\d+)$/);

      if (!match) {
        return null;
      }

      return {
        name: match[1].trim(),
        points: Number(match[2]),
      };
    })
    .filter((rule): rule is CatchEventRule => Boolean(rule && rule.name && Number.isFinite(rule.points)));
}

export function formatRuleLines(rules: CatchEventRule[]) {
  return rules.map((rule) => `${rule.name}: ${rule.points >= 0 ? '+' : ''}${rule.points}`).join('\n');
}

export function calculateCatchEventScore(
  submission: Pick<CatchEventSubmissionInput, 'species' | 'nature' | 'totalIv'>,
  event: Pick<
    CatchEventConfig,
    'speciesBonuses' | 'speciesPenalties' | 'natureBonuses' | 'naturePenalties'
  >
) {
  const species = normalizeName(submission.species);
  const nature = normalizeName(submission.nature);
  const speciesBonus =
    event.speciesBonuses.find((rule) => normalizeName(rule.name) === species)?.points ?? 0;
  const speciesPenalty =
    event.speciesPenalties?.find((rule) => normalizeName(rule.name) === species)?.points ?? 0;
  const natureBonus =
    event.natureBonuses.find((rule) => normalizeName(rule.name) === nature)?.points ?? 0;
  const naturePenalty =
    event.naturePenalties.find((rule) => normalizeName(rule.name) === nature)?.points ?? 0;

  return submission.totalIv + speciesBonus + speciesPenalty + natureBonus + naturePenalty;
}

function getDateTimePartsInZone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  const hour = parts.hour === '24' ? '00' : parts.hour;

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function getTimezoneOffsetMs(date: Date, timezone: string) {
  const parts = getDateTimePartsInZone(date, timezone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return asUtc - date.getTime();
}

export function zonedLocalDateTimeToUtc(value: string, timezone: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) {
    throw new Error('Catch time must use a datetime-local value.');
  }

  const [, year, month, day, hour, minute, second = '0'] = match;
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
  const firstPass = new Date(localAsUtc - getTimezoneOffsetMs(new Date(localAsUtc), timezone));
  const secondPass = new Date(localAsUtc - getTimezoneOffsetMs(firstPass, timezone));

  return secondPass.toISOString();
}

export function validateCatchEventSubmission(
  input: CatchEventSubmissionInput,
  event: CatchEventConfig,
  browserTimezone?: string
) {
  const flags: string[] = [];

  if (!input.playerIgn.trim()) {
    flags.push('Missing OT / IGN');
  }

  if (!event.targets.map(normalizeName).includes(normalizeName(input.species))) {
    flags.push('Species is not allowed for this event');
  }

  if (input.totalIv < 0 || input.totalIv > 186) {
    flags.push('Total IV must be between 0 and 186');
  }

  if (!natureSet.has(normalizeName(input.nature))) {
    flags.push('Nature is not one of the standard Pokemon natures');
  }

  if (input.screenshotNames.length === 0) {
    flags.push('No screenshots attached');
  }

  if (browserTimezone && input.timezone !== browserTimezone) {
    flags.push('Timezone differs from browser-detected timezone');
  }

  let catchUtc = '';
  try {
    catchUtc = zonedLocalDateTimeToUtc(input.catchLocal, input.timezone);
    const startUtc = zonedLocalDateTimeToUtc(event.startLocal, event.timezone);
    const endUtc = zonedLocalDateTimeToUtc(event.endLocal, event.timezone);

    if (catchUtc < startUtc || catchUtc > endUtc) {
      flags.push('Catch time is outside the event window');
    }
  } catch {
    flags.push('Catch time or timezone could not be parsed');
  }

  return {
    catchUtc,
    flags,
    status: flags.length > 0 ? ('needs-review' as const) : ('valid' as const),
  };
}

export function rankCatchEventSubmissions(submissions: CatchEventSubmission[]) {
  return submissions
    .filter((submission) => submission.status === 'valid' || submission.status === 'needs-review')
    .slice()
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.catchUtc.localeCompare(b.catchUtc);
    })
    .map((submission, index) => ({
      ...submission,
      rank: index + 1,
    }));
}

export function selectCatchEventWinners(
  event: Pick<CatchEventConfig, 'winnerCount' | 'useLowestScoreFinalPlace'>,
  submissions: CatchEventSubmission[]
) {
  const ranked = rankCatchEventSubmissions(submissions);

  if (!event.useLowestScoreFinalPlace || event.winnerCount < 2) {
    return ranked.slice(0, event.winnerCount);
  }

  const highScoreSlots = Math.max(event.winnerCount - 1, 0);
  const highScoreWinners = ranked.slice(0, highScoreSlots);
  const excludedIds = new Set(highScoreWinners.map((submission) => submission.id));
  const lowestScoreWinner = submissions
    .filter(
      (submission) =>
        (submission.status === 'valid' || submission.status === 'needs-review') &&
        !excludedIds.has(submission.id)
    )
    .sort((a, b) => {
      if (a.score !== b.score) {
        return a.score - b.score;
      }

      return a.catchUtc.localeCompare(b.catchUtc);
    })[0];

  return [
    ...highScoreWinners,
    ...(lowestScoreWinner ? [{ ...lowestScoreWinner, rank: event.winnerCount }] : []),
  ];
}
