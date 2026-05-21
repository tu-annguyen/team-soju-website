export type CatchEventStatus =
  | 'pending-verification'
  | 'auto-checked'
  | 'needs-review'
  | 'verified'
  | 'rejected'
  | 'disqualified';

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
  region: string;
  route: string;
  winnerCount: number;
  targets: string[];
  speciesBonuses: CatchEventRule[];
  speciesPenalties: CatchEventRule[];
  natureBonuses: CatchEventRule[];
  naturePenalties: CatchEventRule[];
  useLowestScoreFinalPlace: boolean;
  isLeaderboardPublished: boolean;
  isPrivate?: boolean;
  submissionsClosed?: boolean;
  autoCheckEnabled?: boolean;
  createdAt: string;
  updatedAt?: string;
  submissions?: CatchEventSubmission[];
  leaderboardHidden?: boolean;
};

export type CatchEventSubmissionInput = {
  playerIgn: string;
  species: string;
  nature: string;
  totalIv: number;
  catchLocal: string;
  timezone: string;
  region: string;
  route: string;
  screenshotNames: string[];
  screenshotProofs?: {
    name: string;
    dataUrl?: string;
    url?: string;
    fileName?: string;
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

export type PrizeRelevantCatchEventSubmission = CatchEventSubmission & {
  reviewReasons: string[];
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

  const inputRegion = input.region?.trim() || '';
  const inputRoute = input.route?.trim() || '';

  if (!inputRegion) {
    flags.push('Missing catch region');
  } else if (normalizeName(inputRegion) !== normalizeName(event.region)) {
    flags.push('Catch region differs from event location');
  }

  if (!inputRoute) {
    flags.push('Missing catch route/location');
  } else if (normalizeName(inputRoute) !== normalizeName(event.route)) {
    flags.push('Catch route/location differs from event location');
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
    status: flags.length > 0
      ? ('needs-review' as const)
      : event.autoCheckEnabled
        ? ('auto-checked' as const)
        : ('pending-verification' as const),
  };
}

function isProvisionalLeaderboardStatus(status: CatchEventStatus) {
  return status === 'pending-verification'
    || status === 'auto-checked'
    || status === 'needs-review'
    || status === 'verified';
}

export function rankCatchEventSubmissions(submissions: CatchEventSubmission[]) {
  return submissions
    .filter((submission) => isProvisionalLeaderboardStatus(submission.status))
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
  const validSubmissions = submissions.filter((submission) => submission.status === 'verified');
  const ranked = rankCatchEventSubmissions(validSubmissions);

  if (!event.useLowestScoreFinalPlace || event.winnerCount < 2) {
    return ranked.slice(0, event.winnerCount);
  }

  const highScoreSlots = Math.max(event.winnerCount - 1, 0);
  const highScoreWinners = ranked.slice(0, highScoreSlots);
  const excludedIds = new Set(highScoreWinners.map((submission) => submission.id));
  const lowestScoreWinner = submissions
    .filter(
      (submission) =>
        submission.status === 'verified' && !excludedIds.has(submission.id)
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

export function selectPrizeRelevantSubmissions(
  event: Pick<CatchEventConfig, 'winnerCount' | 'useLowestScoreFinalPlace'>,
  submissions: CatchEventSubmission[]
): PrizeRelevantCatchEventSubmission[] {
  const ranked = rankCatchEventSubmissions(submissions);
  const byId = new Map<string, Set<string>>();
  const addReason = (submission: CatchEventSubmission | undefined, reason: string) => {
    if (!submission) return;
    const reasons = byId.get(submission.id) || new Set<string>();
    reasons.add(reason);
    byId.set(submission.id, reasons);
  };

  const highPrizeSlots = event.useLowestScoreFinalPlace
    ? Math.max(event.winnerCount - 1, 0)
    : event.winnerCount;
  ranked.slice(0, highPrizeSlots).forEach((submission, index) => {
    addReason(submission, `${index + 1}${index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'} place candidate`);
  });
  ranked.slice(0, Math.max(8, highPrizeSlots)).forEach((submission) => addReason(submission, 'Top 5-8 high-score candidate'));

  if (event.useLowestScoreFinalPlace && event.winnerCount > 1) {
    const highPrizeIds = new Set(ranked.slice(0, highPrizeSlots).map((submission) => submission.id));
    const lowRanked = ranked
      .filter((submission) => !highPrizeIds.has(submission.id))
      .slice()
      .sort((left, right) => {
        if (left.score !== right.score) return left.score - right.score;
        return left.catchUtc.localeCompare(right.catchUtc);
      });
    addReason(lowRanked[0], `${event.winnerCount}th place lowest-score candidate`);
    lowRanked.slice(0, 5).forEach((submission) => addReason(submission, 'Bottom 3-5 low-score candidate'));
  }

  const cutoffScores = new Set<number>();
  if (ranked[highPrizeSlots - 1]) cutoffScores.add(ranked[highPrizeSlots - 1].score);
  if (ranked[highPrizeSlots]) cutoffScores.add(ranked[highPrizeSlots].score);
  ranked.forEach((submission) => {
    if (cutoffScores.has(submission.score)) {
      const tied = ranked.filter((candidate) => candidate.score === submission.score);
      if (tied.length > 1) addReason(submission, 'Tie around prize cutoff');
    }
  });

  ranked.forEach((submission) => {
    const isCloseToHighPrize = ranked[highPrizeSlots - 1]
      && Math.abs(submission.score - ranked[highPrizeSlots - 1].score) <= 3;
    if (isCloseToHighPrize) addReason(submission, 'Close to winning');
    if (submission.flags.length || submission.status === 'needs-review') addReason(submission, 'System flag');
  });

  return submissions
    .filter((submission) => byId.has(submission.id))
    .map((submission) => ({
      ...submission,
      reviewReasons: Array.from(byId.get(submission.id) || []),
    }));
}
