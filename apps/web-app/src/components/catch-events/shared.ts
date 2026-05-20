import { zonedLocalDateTimeToUtc } from '../../utils/catchEventScoring';
import type {
  CatchEventConfig,
  CatchEventRule,
  CatchEventStatus,
} from '../../utils/catchEventScoring';

export type ViewMode = 'events' | 'host';
export type LegacyViewMode = ViewMode | 'create' | 'submit' | 'admin' | 'leaderboard';
export type HostTab = 'create' | 'manage';
export type EventTab = 'submission' | 'leaderboard';
export type RuleRow = { id: string; name: string; points: string };
export type AuthUser = { id: string; email: string; ign: string };
export type ScreenshotProof = { name?: string; fileName?: string; dataUrl?: string; url?: string };
export type EventForm = typeof defaultEventForm;
export type SubmissionForm = typeof defaultSubmissionForm;

export type CatchEventOcrResult = {
  playerIgn?: string | null;
  species?: string | null;
  pokedexNumber?: number | null;
  nature?: string | null;
  totalIv?: number | null;
  catchLocal?: string | null;
  catchTimeText?: string | null;
  dateOrder?: string | null;
  location?: string | null;
  confidence?: number | null;
  warnings?: string[];
};

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  replaced?: boolean;
  message?: string;
};

export const DEFAULT_TIMEZONE = 'America/New_York';

export const statusLabelKeys: Record<CatchEventStatus, string> = {
  valid: 'Valid',
  'needs-review': 'Needs Review',
  invalid: 'Invalid',
  disqualified: 'Disqualified',
};

export const fieldClasses =
  'mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-white';
export const labelClasses = 'text-sm font-semibold text-gray-800 dark:text-gray-100';
export const panelClasses =
  'rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900';
export const smallButtonClasses =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:border-emerald-500 dark:border-gray-700 dark:text-gray-100';

export function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function getTodayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function toDateTimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function getDefaultEventWindow() {
  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return {
    startLocal: toDateTimeLocalValue(start),
    endLocal: toDateTimeLocalValue(end),
  };
}

export function pickRandomItems<T>(items: readonly T[], count: number) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled.slice(0, count);
}

export function getTimezoneOptions() {
  const now = new Date();
  const zones =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : [DEFAULT_TIMEZONE, 'America/Los_Angeles', 'UTC', 'Europe/London', 'Asia/Tokyo'];

  return zones.map((zone) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
    }).formatToParts(now);
    const offset = parts.find((part) => part.type === 'timeZoneName')?.value || 'GMT';

    return {
      value: zone,
      label: `${zone} (${offset.replace('GMT', 'UTC')})`,
    };
  });
}

export function formatDateTime(value: string, timezone?: string) {
  if (!value) {
    return 'Unparsed time';
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: timezone,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function formatLocalDateTime(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);

  if (!match) {
    return value;
  }

  const [, year, month, day, hour, minute] = match;
  return `${month}/${day}/${year} ${hour}:${minute}`;
}

export function formatEventTimeForBrowser(value: string, eventTimezone: string, browserTimezone: string) {
  try {
    return formatDateTime(zonedLocalDateTimeToUtc(value, eventTimezone), browserTimezone);
  } catch {
    return `${formatLocalDateTime(value)} ${eventTimezone}`;
  }
}

function hasEventStarted(event: Pick<CatchEventConfig, 'startLocal' | 'timezone'>) {
  try {
    return Date.now() >= new Date(zonedLocalDateTimeToUtc(event.startLocal, event.timezone)).getTime();
  } catch {
    return false;
  }
}

export function getSubmissionDisabledReason(event: CatchEventConfig) {
  if (!hasEventStarted(event)) {
    return 'Submissions open when the event starts.';
  }

  if (event.submissionsClosed) {
    return 'Submissions are closed for this event.';
  }

  return '';
}

export function makeToolUrl(view: ViewMode, eventId?: string, hostTab?: HostTab) {
  if (typeof window === 'undefined') {
    return '/tools/catch-events';
  }

  const url = new URL('/tools/catch-events', window.location.origin);
  url.searchParams.set('view', view);

  if (eventId) {
    url.searchParams.set('event', eventId);
  }

  if (hostTab) {
    url.searchParams.set('tab', hostTab);
  }

  return url.toString();
}

export async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !body.success) {
    throw new Error(body.message || 'Request failed.');
  }

  return body;
}

export function getOrdinal(value: number) {
  const suffix =
    value % 10 === 1 && value % 100 !== 11
      ? 'st'
      : value % 10 === 2 && value % 100 !== 12
        ? 'nd'
        : value % 10 === 3 && value % 100 !== 13
          ? 'rd'
          : 'th';

  return `${value}${suffix}`;
}

export function normalizeQueryView(view: LegacyViewMode | null | undefined): ViewMode {
  return view === 'create' || view === 'admin' || view === 'host' ? 'host' : 'events';
}

export function normalizeHostTab(view: LegacyViewMode | null | undefined, tab?: string | null): HostTab {
  if (tab === 'manage' || view === 'admin') {
    return 'manage';
  }

  return 'create';
}

export function readImageProofs(files: FileList | null) {
  const imageFiles = Array.from(files ?? []);

  return Promise.all(
    imageFiles.map(
      (file) =>
        new Promise<ScreenshotProof>((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () => {
            resolve({
              name: file.name,
              fileName: file.name,
              dataUrl: String(reader.result || ''),
            });
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        })
    )
  );
}

export function splitRules(rows: RuleRow[]) {
  return rows.reduce(
    (groups, row) => {
      const name = row.name.trim();
      const points = Number(row.points);

      if (!name || !Number.isFinite(points) || points === 0) {
        return groups;
      }

      const rule = { name, points };

      if (points > 0) {
        groups.bonuses.push(rule);
      } else {
        groups.penalties.push(rule);
      }

      return groups;
    },
    { bonuses: [] as CatchEventRule[], penalties: [] as CatchEventRule[] }
  );
}

export function rowsFromRules(bonuses: CatchEventRule[] = [], penalties: CatchEventRule[] = []) {
  const rows = [...bonuses, ...penalties].map((rule) => ({
    id: makeId('rule'),
    name: rule.name,
    points: String(rule.points),
  }));

  return rows.length ? rows : [{ id: makeId('rule'), name: '', points: '0' }];
}

export const defaultEventForm = {
  name: '',
  eventDate: '',
  startLocal: '',
  endLocal: '',
  timezone: '',
  region: '',
  route: '',
  winnerCount: '4',
  useLowestScoreFinalPlace: true,
  isPrivate: true,
};

export const defaultSubmissionForm = {
  playerIgn: '',
  species: '',
  nature: 'Jolly',
  totalIv: 0,
  catchLocal: '',
  timezone: '',
  natureOtScreenshot: null as ScreenshotProof | null,
  ivsScreenshot: null as ScreenshotProof | null,
  infoScreenshot: null as ScreenshotProof | null,
  region: '',
  route: '',
};

export function getSubmissionProofs(form: typeof defaultSubmissionForm) {
  return [
    { role: 'nature-ot', proof: form.natureOtScreenshot },
    { role: 'ivs', proof: form.ivsScreenshot },
    { role: 'information', proof: form.infoScreenshot },
  ].filter((entry): entry is { role: 'nature-ot' | 'ivs' | 'information'; proof: ScreenshotProof } => Boolean(entry.proof));
}

export const defaultSpeciesRows: RuleRow[] = [
  { id: makeId('species'), name: '', points: '0' },
];

export const defaultNatureRows: RuleRow[] = [
  { id: makeId('nature'), name: '', points: '0' },
];
