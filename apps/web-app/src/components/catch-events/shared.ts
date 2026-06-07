import { zonedLocalDateTimeToUtc } from '../../utils/catchEventScoring';
import type {
  CatchEventConfig,
  CatchEventRule,
  CatchEventStatus,
} from '../../utils/catchEventScoring';
import type { Locale } from '../../i18n';

export type ViewMode = 'events' | 'host';
export type LegacyViewMode = ViewMode | 'create' | 'submit' | 'admin' | 'leaderboard';
export type HostTab = 'create' | 'manage';
export type EventTab = 'submission' | 'leaderboard';
export type RuleRow = { id: string; name: string; points: string };
export type AuthUser = { id: string; email: string; ign: string };
export type ScreenshotProof = { name?: string; fileName?: string; dataUrl?: string; url?: string };
export type EventForm = typeof defaultEventForm;
export type SubmissionForm = typeof defaultSubmissionForm;
export type TimezoneOption = {
  value: string;
  label: string;
};

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
  'pending-verification': 'Pending Verification',
  'auto-checked': 'Auto-Checked',
  'needs-review': 'Needs Review',
  verified: 'Verified',
  rejected: 'Rejected',
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

export function getTimezoneOptions(): TimezoneOption[] {
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

function getIntlLocale(locale: Locale | string = 'en') {
  if (locale === 'zh') return 'zh-CN';
  if (locale === 'es') return 'es-ES';
  return 'en-US';
}

function getDateParts(date: Date, locale: Locale | string = 'en', timezone?: string) {
  const parts = new Intl.DateTimeFormat(getIntlLocale(locale), {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  return {
    year: parts.find((part) => part.type === 'year')?.value || '0000',
    month: parts.find((part) => part.type === 'month')?.value || '00',
    day: parts.find((part) => part.type === 'day')?.value || '00',
  };
}

const EN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const ES_MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function formatNormalizedDateParts(parts: { year: string; month: string; day: string }, locale: Locale | string = 'en') {
  return locale === 'zh'
    ? `${parts.year}年${parts.month}月${parts.day}日`
    : `${parts.year}-${parts.month}-${parts.day}`;
}

function formatWrittenDateParts(parts: { year: string; month: string; day: string }, locale: Locale | string = 'en') {
  if (locale === 'zh') {
    return formatNormalizedDateParts(parts, locale);
  }

  const monthIndex = Math.max(0, Math.min(11, Number(parts.month) - 1));
  const day = Number(parts.day);

  if (locale === 'es') {
    return `${String(day)} de ${ES_MONTHS[monthIndex]} de ${parts.year}`;
  }

  return `${EN_MONTHS[monthIndex]} ${day}, ${parts.year}`;
}

function formatTime(date: Date, locale: Locale | string = 'en', timezone?: string) {
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(date);
}

export function formatDateTime(value: string, timezone?: string, locale: Locale | string = 'en') {
  if (!value) {
    return 'Unparsed time';
  }

  try {
    return new Intl.DateTimeFormat(getIntlLocale(locale), {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: timezone,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function formatLocalDate(value: string, locale: Locale | string = 'en') {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);

  if (!match) {
    return value;
  }

  const [, year, month, day] = match;
  return formatNormalizedDateParts({ year, month, day }, locale);
}

export function formatLocalDateTime(value: string, locale: Locale | string = 'en') {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);

  if (!match) {
    return value;
  }

  const [, year, month, day, hour, minute] = match;
  return `${formatNormalizedDateParts({ year, month, day }, locale)} ${hour}:${minute}`;
}

export function formatEventTimeForBrowser(
  value: string,
  eventTimezone: string,
  browserTimezone: string,
  locale: Locale | string = 'en'
) {
  try {
    const date = new Date(zonedLocalDateTimeToUtc(value, eventTimezone));
    return `${formatWrittenDateParts(getDateParts(date, locale, browserTimezone), locale)} ${formatTime(date, locale, browserTimezone)}`;
  } catch {
    return `${formatLocalDateTime(value, locale)} ${eventTimezone}`;
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
    const apiError = new Error(body.message || 'Request failed.');
    if ((body as any).errors) {
      (apiError as any).errors = (body as any).errors;
    }
    throw apiError;
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

export function rowsFromRules(
  bonuses: CatchEventRule[] = [],
  penalties: CatchEventRule[] = [],
  includeBlankRow = true
) {
  const rows = [...bonuses, ...penalties].map((rule) => ({
    id: makeId('rule'),
    name: rule.name,
    points: String(rule.points),
  }));

  return rows.length || !includeBlankRow ? rows : [{ id: makeId('rule'), name: '', points: '0' }];
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
  autoCheckEnabled: false,
};

export const defaultSubmissionForm = {
  playerIgn: '',
  species: '',
  nature: '',
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

export const defaultNatureRows: RuleRow[] = [];
