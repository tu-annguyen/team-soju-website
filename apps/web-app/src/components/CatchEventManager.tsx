import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  POKEMON_NATURES,
  calculateCatchEventScore,
  rankCatchEventSubmissions,
  selectCatchEventWinners,
  slugifyEventName,
  validateCatchEventSubmission,
  zonedLocalDateTimeToUtc,
} from '../utils/catchEventScoring';
import type {
  CatchEventConfig,
  CatchEventRule,
  CatchEventStatus,
  CatchEventSubmission,
} from '../utils/catchEventScoring';
import {
  CATCH_EVENT_REGIONS,
  CATCH_EVENT_ROUTES_BY_REGION,
  type CatchEventRegion,
} from '../utils/catchEventLocations';
import { getClientLocale, getTranslations, type Locale } from '../i18n';
import { POKEMON_SPECIES_NAME_SET, POKEMON_SPECIES_NAMES } from '../utils/pokemonSpecies';

type ViewMode = 'events' | 'host';
type LegacyViewMode = ViewMode | 'create' | 'submit' | 'admin' | 'leaderboard';
type HostTab = 'create' | 'manage';
type EventTab = 'submission' | 'leaderboard';
type RuleRow = { id: string; name: string; points: string };
type AuthUser = { id: string; email: string; ign: string };
type ScreenshotProof = { name?: string; fileName?: string; dataUrl?: string; url?: string };
type CatchEventOcrResult = {
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
type ApiResponse<T> = {
  success: boolean;
  data: T;
  replaced?: boolean;
  message?: string;
};

type Props = {
  apiBaseUrl: string;
  initialView?: LegacyViewMode;
  locale?: Locale | string;
};

const DEFAULT_TIMEZONE = 'America/New_York';
const NATURE_SET = new Set<string>(POKEMON_NATURES.map((nature) => nature.toLowerCase()));

const statusLabelKeys: Record<CatchEventStatus, string> = {
  valid: 'Valid',
  'needs-review': 'Needs Review',
  invalid: 'Invalid',
  disqualified: 'Disqualified',
};

const fieldClasses =
  'mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-white';
const labelClasses = 'text-sm font-semibold text-gray-800 dark:text-gray-100';
const panelClasses =
  'rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900';
const smallButtonClasses =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:border-emerald-500 dark:border-gray-700 dark:text-gray-100';

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function getTodayLocalDate() {
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

function getDefaultEventWindow() {
  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return {
    startLocal: toDateTimeLocalValue(start),
    endLocal: toDateTimeLocalValue(end),
  };
}

function pickRandomItems<T>(items: readonly T[], count: number) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled.slice(0, count);
}

function getTimezoneOptions() {
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

function formatDateTime(value: string, timezone?: string) {
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

function formatLocalDateTime(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);

  if (!match) {
    return value;
  }

  const [, year, month, day, hour, minute] = match;
  return `${month}/${day}/${year} ${hour}:${minute}`;
}

function formatEventTimeForBrowser(value: string, eventTimezone: string, browserTimezone: string) {
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

function getSubmissionDisabledReason(event: CatchEventConfig) {
  if (!hasEventStarted(event)) {
    return 'Submissions open when the event starts.';
  }

  if (event.submissionsClosed) {
    return 'Submissions are closed for this event.';
  }

  return '';
}

function makeToolUrl(view: ViewMode, eventId?: string, hostTab?: HostTab) {
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

async function fetchJson<T>(url: string, init?: RequestInit) {
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

function getOrdinal(value: number) {
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

function normalizeQueryView(view: LegacyViewMode | null | undefined): ViewMode {
  return view === 'create' || view === 'admin' || view === 'host' ? 'host' : 'events';
}

function normalizeHostTab(view: LegacyViewMode | null | undefined, tab?: string | null): HostTab {
  if (tab === 'manage' || view === 'admin') {
    return 'manage';
  }

  return 'create';
}

function readImageProofs(files: FileList | null) {
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

function splitRules(rows: RuleRow[]) {
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

function rowsFromRules(bonuses: CatchEventRule[] = [], penalties: CatchEventRule[] = []) {
  const rows = [...bonuses, ...penalties].map((rule) => ({
    id: makeId('rule'),
    name: rule.name,
    points: String(rule.points),
  }));

  return rows.length ? rows : [{ id: makeId('rule'), name: '', points: '0' }];
}

const defaultEventForm = {
  name: '',
  eventDate: '',
  startLocal: '',
  endLocal: '',
  timezone: '',
  region: '',
  route: '',
  winnerCount: '4',
  useLowestScoreFinalPlace: true,
};

const defaultSubmissionForm = {
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

function getSubmissionProofs(form: typeof defaultSubmissionForm) {
  return [
    { role: 'nature-ot', proof: form.natureOtScreenshot },
    { role: 'ivs', proof: form.ivsScreenshot },
    { role: 'information', proof: form.infoScreenshot },
  ].filter((entry): entry is { role: 'nature-ot' | 'ivs' | 'information'; proof: ScreenshotProof } => Boolean(entry.proof));
}

const defaultSpeciesRows: RuleRow[] = [
  { id: makeId('species'), name: '', points: '0' },
];
const defaultNatureRows: RuleRow[] = [
  { id: makeId('nature'), name: '', points: '0' },
];

const CatchEventManager = ({ apiBaseUrl, initialView = 'events', locale }: Props) => {
  const normalizedApiBaseUrl = useMemo(() => apiBaseUrl.replace(/\/+$/, ''), [apiBaseUrl]);
  const activeLocale = useMemo(() => getClientLocale(locale), [locale]);
  const catchEventTranslations = useMemo(
    () => getTranslations(activeLocale).tools.catchEventManager,
    [activeLocale]
  );
  const uiCopy = catchEventTranslations.ui as Record<string, string>;
  const speciesCopy = catchEventTranslations.pokemonSpecies as Record<string, string>;
  const natureCopy = catchEventTranslations.natures as Record<string, string>;
  const regionCopy = catchEventTranslations.regions as Record<string, string>;
  const locationCopy = catchEventTranslations.locations as Record<string, string>;
  const tr = useCallback((text: string) => uiCopy[text] || text, [uiCopy]);
  const translateSpeciesDisplay = useCallback((species: string) => speciesCopy[species] || species, [speciesCopy]);
  const translateNatureDisplay = useCallback((nature: string) => natureCopy[nature] || nature, [natureCopy]);
  const translateRegion = useCallback((region: string) => regionCopy[region] || region, [regionCopy]);
  const translateLocation = useCallback((location: string) => {
    const translatedLocation = locationCopy[location];

    if (translatedLocation) {
      return translatedLocation;
    }

    const routeMatch = /^Route (\d+)$/.exec(location);

    if (routeMatch) {
      return catchEventTranslations.routePattern.replace('{number}', routeMatch[1]);
    }

    return location;
  }, [catchEventTranslations.routePattern, locationCopy]);

  const statusLabels = useMemo(
    () => Object.fromEntries(
      Object.entries(statusLabelKeys).map(([status, label]) => [status, tr(label)])
    ) as Record<CatchEventStatus, string>,
    [tr]
  );
  const [events, setEvents] = useState<CatchEventConfig[]>([]);
  const [submissions, setSubmissions] = useState<CatchEventSubmission[]>([]);
  const [view, setView] = useState<ViewMode>(normalizeQueryView(initialView));
  const [hostTab, setHostTab] = useState<HostTab>(normalizeHostTab(initialView));
  const [eventTab, setEventTab] = useState<EventTab>(initialView === 'leaderboard' ? 'leaderboard' : 'submission');
  const [eventFilters, setEventFilters] = useState({
    search: '',
    target: '',
    date: '',
    host: '',
  });
  const [activeEventId, setActiveEventId] = useState('');
  const [eventForm, setEventForm] = useState(defaultEventForm);
  const [speciesRows, setSpeciesRows] = useState<RuleRow[]>(defaultSpeciesRows);
  const [natureRows, setNatureRows] = useState<RuleRow[]>(defaultNatureRows);
  const [submissionForm, setSubmissionForm] = useState(defaultSubmissionForm);
  const [browserTimezone, setBrowserTimezone] = useState(DEFAULT_TIMEZONE);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [createdEventId, setCreatedEventId] = useState('');
  const [editingEventId, setEditingEventId] = useState('');
  const [createError, setCreateError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [ocrMessage, setOcrMessage] = useState('');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [selectedProof, setSelectedProof] = useState<ScreenshotProof | null>(null);
  const timezoneOptions = useMemo(getTimezoneOptions, []);
  const loadEventDetails = useCallback(async (eventId: string, nextView: LegacyViewMode = view) => {
    if (!eventId) {
      setSubmissions([]);
      return null;
    }

    const response = await fetchJson<CatchEventConfig>(
      `${normalizedApiBaseUrl}/catch-events/${encodeURIComponent(eventId)}${nextView === 'leaderboard' ? '?view=leaderboard' : ''}`
    );

    setEvents((current) => {
      const withoutEvent = current.filter((event) => event.id !== response.data.id);
      return [response.data, ...withoutEvent];
    });
    setSubmissions(response.data.submissions || []);
    return response.data;
  }, [normalizedApiBaseUrl, view]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryView = params.get('view') as LegacyViewMode | null;
    const queryTab = params.get('tab');
    const queryEvent = params.get('event') || '';
    const detectedTimezone = getBrowserTimezone();

    setActiveEventId(queryEvent);
    setBrowserTimezone(detectedTimezone);
    setEventForm((current) => ({
      ...(() => {
        const defaultWindow = getDefaultEventWindow();
        return {
          ...current,
          startLocal: current.startLocal || defaultWindow.startLocal,
          endLocal: current.endLocal || defaultWindow.endLocal,
        };
      })(),
      eventDate: current.eventDate || getTodayLocalDate(),
      timezone: current.timezone || detectedTimezone,
      region: current.region || 'Hoenn',
    }));
    setSpeciesRows((current) => {
      if (current.some((row) => row.name.trim())) {
        return current;
      }

      const [bonusSpecies, neutralSpecies, penaltySpecies] = pickRandomItems(POKEMON_SPECIES_NAMES, 3);
      return [
        { id: makeId('species'), name: bonusSpecies, points: '5' },
        { id: makeId('species'), name: neutralSpecies, points: '0' },
        { id: makeId('species'), name: penaltySpecies, points: '-5' },
      ];
    });
    setNatureRows((current) => {
      if (current.some((row) => row.name.trim())) {
        return current;
      }

      const [bonusNature, penaltyNature] = pickRandomItems(POKEMON_NATURES, 2);
      return [
        { id: makeId('nature'), name: bonusNature, points: '5' },
        { id: makeId('nature'), name: penaltyNature, points: '-5' },
      ];
    });
    setSubmissionForm((current) => ({ ...current, timezone: detectedTimezone }));

    if (queryView && ['events', 'host', 'create', 'submit', 'admin', 'leaderboard'].includes(queryView)) {
      setView(normalizeQueryView(queryView));
      setHostTab(normalizeHostTab(queryView, queryTab));
      setEventTab(queryView === 'leaderboard' ? 'leaderboard' : 'submission');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      try {
        const params = new URLSearchParams(window.location.search);
        const queryEvent = params.get('event') || '';
        const queryView = params.get('view') || '';

        if (queryEvent) {
          const event = await loadEventDetails(queryEvent, view);
          if (isMounted) {
            setActiveEventId(event?.id || queryEvent);
          }
          return;
        }

        const response = await fetchJson<CatchEventConfig[]>(`${normalizedApiBaseUrl}/catch-events`);

        if (isMounted) {
          setEvents(response.data);
          setActiveEventId((current) => current || response.data[0]?.id || '');
        }
      } catch (error) {
        console.error('Error loading catch events:', error);
      }
    }

    loadEvents();

    return () => {
      isMounted = false;
    };
  }, [loadEventDetails, normalizedApiBaseUrl, view]);

  useEffect(() => {
    if (!authUser || view !== 'host' || hostTab !== 'manage') {
      return;
    }

    let isMounted = true;

    async function loadOwnedEvents() {
      try {
        const response = await fetchJson<CatchEventConfig[]>(`${normalizedApiBaseUrl}/catch-events?owner=me`);
        if (isMounted) {
          setEvents(response.data);
          const nextActiveEventId = activeEventId || response.data[0]?.id || '';
          setActiveEventId(nextActiveEventId);
          if (nextActiveEventId) {
            await loadEventDetails(nextActiveEventId, 'admin');
          }
        }
      } catch (error) {
        console.error('Error loading owned catch events:', error);
      }
    }

    loadOwnedEvents();

    return () => {
      isMounted = false;
    };
  }, [activeEventId, authUser, hostTab, loadEventDetails, normalizedApiBaseUrl, view]);

  useEffect(() => {
    if (!activeEventId) {
      setSubmissions([]);
      return;
    }

    loadEventDetails(activeEventId).catch((error) => {
      console.error('Error loading catch event:', error);
    });
  }, [activeEventId, loadEventDetails]);

  useEffect(() => {
    if (view !== 'host' || hostTab !== 'manage' || !activeEventId || !authUser) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      loadEventDetails(activeEventId, 'admin').catch((error) => {
        console.error('Error refreshing catch event submissions:', error);
      });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [activeEventId, authUser, hostTab, loadEventDetails, view]);

  useEffect(() => {
    let isMounted = true;

    async function loadAuthUser() {
      try {
        const response = await fetch(`${normalizedApiBaseUrl}/auth/me`, { credentials: 'include' });
        const body = await response.json();

        if (isMounted && response.ok && body.success) {
          setAuthUser(body.data || null);
        }
      } catch {
        if (isMounted) {
          setAuthUser(null);
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    }

    loadAuthUser();

    return () => {
      isMounted = false;
    };
  }, [normalizedApiBaseUrl]);

  const ownedEvents = useMemo(
    () => events.filter((event) => event.ownerUserId && event.ownerUserId === authUser?.id),
    [authUser?.id, events]
  );
  const eventOptions = view === 'host' && hostTab === 'manage' ? ownedEvents : events;
  const filteredEvents = useMemo(() => {
    const search = eventFilters.search.trim().toLowerCase();
    const target = eventFilters.target.trim().toLowerCase();
    const date = eventFilters.date.trim().toLowerCase();
    const host = eventFilters.host.trim().toLowerCase();

    return events.filter((event) => {
      const eventHaystack = [
        event.name,
        event.route,
        translateLocation(event.route),
        event.region,
        translateRegion(event.region),
        event.startLocal,
        event.endLocal,
        event.timezone,
        event.ownerIgn || '',
        ...event.targets,
        ...event.targets.map(translateSpeciesDisplay),
      ].join(' ').toLowerCase();
      const targetHaystack = [...event.targets, ...event.targets.map(translateSpeciesDisplay)].join(' ').toLowerCase();
      const dateHaystack = `${event.eventDate} ${event.startLocal} ${event.endLocal} ${formatLocalDateTime(event.startLocal)} ${formatLocalDateTime(event.endLocal)}`.toLowerCase();
      const hostHaystack = `${event.ownerIgn || ''} ${event.ownerUserId || ''}`.toLowerCase();

      return (!search || eventHaystack.includes(search))
        && (!target || targetHaystack.includes(target))
        && (!date || dateHaystack.includes(date))
        && (!host || hostHaystack.includes(host));
    });
  }, [eventFilters, events, translateLocation, translateRegion, translateSpeciesDisplay]);
  const activeEvent = useMemo(
    () => eventOptions.find((event) => event.id === activeEventId) ?? eventOptions[0],
    [activeEventId, eventOptions]
  );
  useEffect(() => {
    if (!activeEvent) return;

    setSubmissionForm((current) => ({
      ...current,
      species: current.species || activeEvent.targets[0] || '',
      region: current.region || activeEvent.region,
      route: current.route || activeEvent.route,
    }));
  }, [activeEvent?.id]);
  useEffect(() => {
    const canViewLeaderboard = Boolean(
      activeEvent?.isLeaderboardPublished || (authUser && activeEvent?.ownerUserId === authUser.id)
    );

    if (eventTab === 'leaderboard' && activeEvent && !canViewLeaderboard) {
      setEventTab('submission');
    }
    if (eventTab === 'submission' && activeEvent && getSubmissionDisabledReason(activeEvent) && canViewLeaderboard) {
      setEventTab('leaderboard');
    }
  }, [activeEvent, authUser, eventTab]);
  const activeSubmissions = useMemo(
    () => submissions.filter((submission) => submission.eventId === activeEvent?.id),
    [activeEvent?.id, submissions]
  );

  function updateRuleRow(kind: 'species' | 'nature', rowId: string, patch: Partial<RuleRow>) {
    const updateRows = (rows: RuleRow[]) =>
      rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row));

    if (kind === 'species') {
      setSpeciesRows(updateRows);
      return;
    }

    setNatureRows(updateRows);
  }

  function removeRuleRow(kind: 'species' | 'nature', rowId: string) {
    const updateRows = (rows: RuleRow[], prefix: string) => {
      const nextRows = rows.filter((row) => row.id !== rowId);
      return nextRows.length ? nextRows : [{ id: makeId(prefix), name: '', points: '0' }];
    };

    if (kind === 'species') {
      setSpeciesRows((rows) => updateRows(rows, 'species'));
      return;
    }

    setNatureRows((rows) => updateRows(rows, 'nature'));
  }

  function validateEventForm() {
    const speciesNames = speciesRows.map((row) => row.name.trim()).filter(Boolean);
    const natureNames = natureRows.map((row) => row.name.trim()).filter(Boolean);

    if (!authUser) {
      return tr('Sign in before creating a catch event so the admin dashboard can be tied to your account.');
    }

    if (!eventForm.name.trim()) {
      return tr('Event name is required.');
    }

    if (!eventForm.region || !CATCH_EVENT_REGIONS.includes(eventForm.region as CatchEventRegion)) {
      return tr('Choose a valid region.');
    }

    if (!eventForm.route.trim()) {
      return tr('Choose a route.');
    }

    if (speciesNames.length === 0) {
      return tr('Add at least one target Pokemon.');
    }

    if (new Set(speciesNames.map((name) => name.toLowerCase())).size !== speciesNames.length) {
      return tr('Each target Pokemon can only be added once.');
    }

    const invalidSpecies = speciesNames.find((name) => !POKEMON_SPECIES_NAME_SET.has(name.toLowerCase()));
    if (invalidSpecies) {
      return `${invalidSpecies} ${tr('is not in the supported Pokemon species list.')}`;
    }

    const invalidSpeciesPoints = speciesRows.find(
      (row) => row.name.trim() && (row.points === '' || row.points === '-' || !Number.isFinite(Number(row.points)))
    );
    if (invalidSpeciesPoints) {
      return activeLocale === 'zh'
        ? `${tr('Enter a numeric point value for')}${invalidSpeciesPoints.name}.`
        : `${tr('Enter a numeric point value for')} ${invalidSpeciesPoints.name}.`;
    }

    const invalidNature = natureNames.find((name) => !NATURE_SET.has(name.toLowerCase()));
    if (invalidNature) {
      return `${invalidNature} ${tr('is not a valid Pokemon nature.')}`;
    }

    const invalidNaturePoints = natureRows.find(
      (row) => row.name.trim() && (row.points === '' || row.points === '-' || !Number.isFinite(Number(row.points)))
    );
    if (invalidNaturePoints) {
      return activeLocale === 'zh'
        ? `${tr('Enter a numeric point value for')}${invalidNaturePoints.name}.`
        : `${tr('Enter a numeric point value for')} ${invalidNaturePoints.name}.`;
    }

    if (new Date(eventForm.endLocal) <= new Date(eventForm.startLocal)) {
      return tr('End time must be after start time.');
    }

    return '';
  }

  async function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateEventForm();

    if (validationError) {
      setCreateError(validationError);
      return;
    }

    const speciesRules = splitRules(speciesRows);
    const natureRules = splitRules(natureRows);
    const idBase = editingEventId || slugifyEventName(eventForm.name);
    const existingIds = new Set(events.map((storedEvent) => storedEvent.id));
    const id = editingEventId ? editingEventId : existingIds.has(idBase) ? `${idBase}-${Date.now().toString(36)}` : idBase;
    try {
      const response = await fetchJson<CatchEventConfig>(`${normalizedApiBaseUrl}/catch-events${editingEventId ? `/${encodeURIComponent(editingEventId)}` : ''}`, {
        method: editingEventId ? 'PUT' : 'POST',
        body: JSON.stringify({
          id,
          slug: id,
          name: eventForm.name.trim(),
          eventDate: eventForm.startLocal.slice(0, 10),
          startLocal: eventForm.startLocal,
          endLocal: eventForm.endLocal,
          timezone: eventForm.timezone.trim() || DEFAULT_TIMEZONE,
          region: eventForm.region,
          route: eventForm.route.trim(),
          winnerCount: Number(eventForm.winnerCount),
          targets: speciesRows.map((row) => row.name.trim()).filter(Boolean),
          speciesBonuses: speciesRules.bonuses,
          speciesPenalties: speciesRules.penalties,
          natureBonuses: natureRules.bonuses,
          naturePenalties: natureRules.penalties,
          useLowestScoreFinalPlace: eventForm.useLowestScoreFinalPlace,
          isLeaderboardPublished: false,
        }),
      });

      setEvents([response.data, ...events.filter((storedEvent) => storedEvent.id !== response.data.id)]);
      setSubmissions(response.data.submissions || []);
      setActiveEventId(response.data.id);
      setCreatedEventId(response.data.id);
      setEditingEventId('');
      setCreateError('');
      setView('host');
      setHostTab('manage');
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : editingEventId ? tr('Failed to update event.') : tr('Failed to create event.'));
    }
  }

  async function handleSubmitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeEvent) {
      setSubmitMessage(tr('Create or select an event before submitting an entry.'));
      return;
    }
    const disabledReason = getSubmissionDisabledReason(activeEvent);
    if (disabledReason) {
      setSubmitMessage(tr(disabledReason));
      return;
    }

    const screenshotProofs = getSubmissionProofs(submissionForm).map((entry) => entry.proof);
    const input = {
      playerIgn: submissionForm.playerIgn.trim(),
      species: submissionForm.species.trim(),
      nature: submissionForm.nature.trim(),
      totalIv: Number(submissionForm.totalIv),
      catchLocal: submissionForm.catchLocal,
      timezone: submissionForm.timezone || browserTimezone,
      region: submissionForm.region.trim(),
      route: submissionForm.route.trim(),
      screenshotNames: screenshotProofs.map((proof) => proof.name || proof.fileName || tr('screenshot.png')),
      screenshotProofs,
    };
    const validation = validateCatchEventSubmission(input, activeEvent, browserTimezone);
    const payload = {
      playerIgn: input.playerIgn,
      species: input.species,
      nature: input.nature,
      totalIv: input.totalIv,
      catchLocal: input.catchLocal,
      timezone: input.timezone,
      region: input.region,
      route: input.route,
      score: calculateCatchEventScore(input, activeEvent),
      catchUtc: validation.catchUtc,
      flags: validation.flags,
      status: validation.status,
      screenshots: input.screenshotProofs.map((proof) => ({
        name: proof.name || proof.fileName || tr('screenshot.png'),
        contentType: proof.dataUrl?.match(/^data:([^;,]+)/)?.[1] || 'image/png',
        dataUrl: proof.dataUrl,
      })).filter((proof) => proof.dataUrl),
    };

    try {
      const response = await fetchJson<CatchEventSubmission>(
        `${normalizedApiBaseUrl}/catch-events/${encodeURIComponent(activeEvent.id)}/submissions`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      const nextSubmission = response.data;
      setSubmissions((current) => [
        nextSubmission,
        ...current.filter((submission) => submission.id !== nextSubmission.id),
      ]);
      setSubmissionForm({
        ...defaultSubmissionForm,
        timezone: browserTimezone,
        region: activeEvent.region,
        route: activeEvent.route,
        species: activeEvent.targets[0] ?? '',
        nature: 'Jolly',
      });
      setSubmitMessage(
        response.replaced
          ? tr('Entry submitted. Your previous submission was overwritten.')
          : validation.flags.length
            ? tr('Entry submitted and marked Needs Review.')
            : tr('Entry submitted successfully.')
      );
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : tr('Failed to submit entry.'));
    }
  }

  async function handleAutofillFromScreenshots() {
    const screenshotEntries = getSubmissionProofs(submissionForm);
    const screenshots = screenshotEntries
      .map(({ role, proof }) => ({
        name: proof.name || proof.fileName || tr('screenshot.png'),
        contentType: proof.dataUrl?.match(/^data:([^;,]+)/)?.[1] || 'image/png',
        role,
        dataUrl: proof.dataUrl,
      }))
      .filter((proof): proof is { name: string; contentType: string; role: 'nature-ot' | 'ivs' | 'information'; dataUrl: string } => Boolean(proof.dataUrl));

    if (screenshots.length < 3) {
      setOcrMessage(tr('Upload the Nature/OT, IVs, and Information screenshots before using autofill.'));
      return;
    }

    setIsOcrLoading(true);
    setOcrMessage(tr('Reading screenshots...'));

    try {
      const response = await fetchJson<CatchEventOcrResult>(`${normalizedApiBaseUrl}/catch-events/ocr`, {
        method: 'POST',
        body: JSON.stringify({
          screenshots,
          locale: navigator.language || '',
          timezone: submissionForm.timezone || browserTimezone,
        }),
      });
      const result = response.data;
      const updates: Partial<typeof submissionForm> = {};

      if (result.playerIgn) updates.playerIgn = result.playerIgn;
      if (result.species) updates.species = result.species;
      if (result.nature) updates.nature = result.nature;
      if (typeof result.totalIv === 'number') updates.totalIv = result.totalIv;
      if (result.catchLocal) updates.catchLocal = result.catchLocal;
      if (result.location) updates.route = result.location;

      setSubmissionForm((current) => ({
        ...current,
        ...updates,
      }));

      const filledFields = Object.keys(updates).length;
      const warnings = result.warnings?.length ? ` ${result.warnings.join(' ')}` : '';
      const locationNote = result.location ? ` ${tr('Route read as')} ${result.location}; ${tr('choose the matching region before submitting.')}` : '';
      setOcrMessage(
        filledFields
          ? `${tr('Autofill filled')} ${filledFields} ${tr(filledFields === 1 ? 'field' : 'fields')}. ${tr('Verify before submitting')}.${locationNote}${warnings}`
          : `${tr('OCR ran, but did not find fields confidently enough to autofill.')}${locationNote}${warnings}`
      );
    } catch (error) {
      setOcrMessage(error instanceof Error ? error.message : tr('Failed to read screenshots.'));
    } finally {
      setIsOcrLoading(false);
    }
  }

  async function updateSubmissionStatus(submissionId: string, status: CatchEventStatus) {
    if (!activeEvent) return;

    try {
      const response = await fetchJson<CatchEventConfig>(
        `${normalizedApiBaseUrl}/catch-events/${encodeURIComponent(activeEvent.id)}/submissions/${encodeURIComponent(submissionId)}/status`,
        {
          method: 'POST',
          body: JSON.stringify({ status }),
        }
      );
      setEvents((current) => current.map((event) => event.id === response.data.id ? response.data : event));
      setSubmissions(response.data.submissions || []);
    } catch (error) {
      console.error('Error updating submission status:', error);
    }
  }

  async function updateLeaderboardPublished(eventId: string, isLeaderboardPublished: boolean) {
    try {
      const response = await fetchJson<CatchEventConfig>(
        `${normalizedApiBaseUrl}/catch-events/${encodeURIComponent(eventId)}/publish`,
        {
          method: 'POST',
          body: JSON.stringify({ isLeaderboardPublished }),
        }
      );
      setEvents((current) => current.map((event) => event.id === response.data.id ? response.data : event));
      setSubmissions(response.data.submissions || []);
    } catch (error) {
      console.error('Error updating leaderboard publish status:', error);
    }
  }

  async function updateSubmissionsClosed(eventId: string, submissionsClosed: boolean) {
    try {
      const response = await fetchJson<CatchEventConfig>(
        `${normalizedApiBaseUrl}/catch-events/${encodeURIComponent(eventId)}/submissions-closed`,
        {
          method: 'POST',
          body: JSON.stringify({ submissionsClosed }),
        }
      );
      setEvents((current) => current.map((event) => event.id === response.data.id ? response.data : event));
      setSubmissions(response.data.submissions || []);
    } catch (error) {
      console.error('Error updating catch event submissions:', error);
    }
  }

  function loadEventIntoForm(event: CatchEventConfig, mode: 'duplicate' | 'edit' = 'duplicate') {
    setEventForm({
      name: mode === 'edit' ? event.name : `${event.name} ${tr('Copy')}`,
      eventDate: event.eventDate,
      startLocal: event.startLocal,
      endLocal: event.endLocal,
      timezone: event.timezone,
      region: event.region,
      route: event.route,
      winnerCount: String(event.winnerCount),
      useLowestScoreFinalPlace: event.useLowestScoreFinalPlace,
    });
    setSpeciesRows(rowsFromRules(event.speciesBonuses, event.speciesPenalties));
    setNatureRows(rowsFromRules(event.natureBonuses, event.naturePenalties));
    setEditingEventId(mode === 'edit' ? event.id : '');
    setCreateError('');
    setView('host');
    setHostTab('create');
  }

  async function deleteEvent(event: CatchEventConfig) {
    const confirmed = window.confirm(
      activeLocale === 'zh'
        ? `${tr('Delete')} ${event.name}？${tr('This will remove its submissions and cannot be undone.')}`
        : `${tr('Delete')} ${event.name}? ${tr('This will remove its submissions and cannot be undone.')}`
    );
    if (!confirmed) return;

    try {
      await fetchJson<CatchEventConfig>(
        `${normalizedApiBaseUrl}/catch-events/${encodeURIComponent(event.id)}`,
        { method: 'DELETE' }
      );
      setEvents((current) => current.filter((storedEvent) => storedEvent.id !== event.id));
      setSubmissions((current) => current.filter((submission) => submission.eventId !== event.id));
      setActiveEventId((current) => current === event.id ? '' : current);
    } catch (error) {
      console.error('Error deleting catch event:', error);
    }
  }

  const rulesEditor = (
    title: string,
    kind: 'species' | 'nature',
    rows: RuleRow[],
    options: readonly string[]
  ) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-950 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {tr('Use positive points for bonuses, negative points for penalties, and 0 for neutral scoring.')}
          </p>
        </div>
        <button
          type="button"
          className={smallButtonClasses}
          onClick={() =>
            kind === 'species'
              ? setSpeciesRows((current) => [...current, { id: makeId('species'), name: '', points: '0' }])
              : setNatureRows((current) => [...current, { id: makeId('nature'), name: '', points: '0' }])
          }
        >
          {tr('Add')}
        </button>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
            <label className={labelClasses}>
              {kind === 'species' ? tr('Pokemon species') : tr('Nature')}
              <input
                className={fieldClasses}
                list={kind === 'species' ? 'pokemon-species-options' : 'nature-options'}
                value={row.name}
                onChange={(event) => updateRuleRow(kind, row.id, { name: event.target.value })}
                required
              />
            </label>
            <label className={labelClasses}>
              {tr('Points')}
              <input
                className={fieldClasses}
                inputMode="numeric"
                pattern="-?[0-9]*"
                value={row.points}
                onChange={(event) => {
                  const nextValue = event.target.value;

                  if (/^-?\d*$/.test(nextValue)) {
                    updateRuleRow(kind, row.id, { points: nextValue });
                  }
                }}
              />
            </label>
            <button
              type="button"
              className={`${smallButtonClasses} self-end`}
              onClick={() => removeRuleRow(kind, row.id)}
            >
              {tr('Remove')}
            </button>
          </div>
        ))}
      </div>
      <datalist id={kind === 'species' ? 'pokemon-species-options' : 'nature-options'}>
        {options.map((option) => (
          <option
            key={option}
            value={option}
            label={kind === 'species' ? translateSpeciesDisplay(option) : translateNatureDisplay(option)}
          />
        ))}
      </datalist>
    </div>
  );

  const renderRuleList = (
    title: string,
    bonuses: CatchEventRule[],
    penalties: CatchEventRule[],
    translateValue: (value: string) => string
  ) => {
    const rules = [...bonuses, ...penalties];

    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
        {rules.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {rules.map((rule) => (
              <span
                key={`${title}-${rule.name}-${rule.points}`}
                className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                  rule.points >= 0
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                    : 'bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                }`}
              >
                {translateValue(rule.name)} {rule.points >= 0 ? '+' : ''}{rule.points}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{tr('No bonuses or penalties.')}</p>
        )}
      </div>
    );
  };

  const renderEventSummary = (event: CatchEventConfig) => (
    <div className={panelClasses}>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            {tr('Selected Event')}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">{event.name}</h2>
          <div className="mt-4 grid gap-3 text-sm text-gray-700 dark:text-gray-300 sm:grid-cols-2">
            <p>
              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{tr('Starts')}</span>
              {formatEventTimeForBrowser(event.startLocal, event.timezone, browserTimezone)}
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                {tr('Event time:')} {formatLocalDateTime(event.startLocal)} {event.timezone}
              </span>
            </p>
            <p>
              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{tr('Ends')}</span>
              {formatEventTimeForBrowser(event.endLocal, event.timezone, browserTimezone)}
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                {tr('Event time:')} {formatLocalDateTime(event.endLocal)} {event.timezone}
              </span>
            </p>
            <p>
              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{tr('Location')}</span>
              {translateLocation(event.route)}, {translateRegion(event.region)}
            </p>
            <p>
              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{tr('Host')}</span>
              {event.ownerIgn || tr('Team Soju')}
            </p>
            <p>
              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{tr('Winners')}</span>
              {event.winnerCount}{event.useLowestScoreFinalPlace ? ` ${tr('including final lowest-score slot')}` : ''}
            </p>
            <p>
              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{tr('Leaderboard')}</span>
              {event.isLeaderboardPublished ? tr('Published') : tr('Not published yet')}
            </p>
            <p>
              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{tr('Submissions')}</span>
              {getSubmissionDisabledReason(event) ? tr(getSubmissionDisabledReason(event)) : tr('Open')}
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{tr('Target Pokemon')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {event.targets.map((target) => (
              <span key={target} className="rounded-lg bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                {translateSpeciesDisplay(target)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {renderRuleList(tr('Species Bonuses & Penalties'), event.speciesBonuses, event.speciesPenalties, translateSpeciesDisplay)}
        {renderRuleList(tr('Nature Bonuses & Penalties'), event.natureBonuses, event.naturePenalties, translateNatureDisplay)}
      </div>
    </div>
  );

  const renderLeaderboard = (event: CatchEventConfig, showUnpublished: boolean) => {
    const eventSubmissions = submissions.filter((submission) => submission.eventId === event.id);
    const eventRanked = rankCatchEventSubmissions(eventSubmissions);
    const eventWinners = selectCatchEventWinners(event, eventSubmissions);

    if (!event.isLeaderboardPublished && !showUnpublished) {
      return (
        <div className={panelClasses}>
          <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{event.name}</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            {tr('This leaderboard is not published yet. Check back after staff confirms the event.')}
          </p>
        </div>
      );
    }

    return (
      <>
        <div className={panelClasses}>
          <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{tr('Winners')}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {eventWinners.map((winner, index) => (
              <div key={winner.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  {getOrdinal(index + 1)}
                  {event.useLowestScoreFinalPlace && index === event.winnerCount - 1
                    ? tr(' - Lowest score')
                    : ''}
                </p>
                <p className="mt-1 text-xl font-bold text-gray-950 dark:text-white">
                  {winner.playerIgn} - {winner.score} {tr('points')}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {translateSpeciesDisplay(winner.species)}, {translateNatureDisplay(winner.nature)}, {tr('caught at')}{' '}
                  {formatDateTime(winner.catchUtc, event.timezone)}
                </p>
              </div>
            ))}
          </div>
          {eventWinners.length === 0 && (
            <p className="mt-4 text-gray-600 dark:text-gray-300">{tr('No valid entries yet.')}</p>
          )}
        </div>
        <div className={panelClasses}>
          <h3 className="text-xl font-bold text-gray-950 dark:text-white">{tr('Leaderboard')}</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800">
                <tr>
                  <th className="py-3 pr-4">{tr('Rank')}</th>
                  <th className="py-3 pr-4">{tr('Player')}</th>
                  <th className="py-3 pr-4">{tr('Pokemon')}</th>
                  <th className="py-3 pr-4">{tr('Score')}</th>
                  <th className="py-3 pr-4">{tr('Catch Time')}</th>
                  <th className="py-3 pr-4">{tr('Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {eventRanked.map((submission) => (
                  <tr key={submission.id}>
                    <td className="py-3 pr-4 font-bold">{submission.rank}</td>
                    <td className="py-3 pr-4 font-semibold text-gray-950 dark:text-white">
                      {submission.playerIgn}
                    </td>
                    <td className="py-3 pr-4">
                      {translateSpeciesDisplay(submission.species)}, {translateNatureDisplay(submission.nature)}
                    </td>
                    <td className="py-3 pr-4 font-bold">{submission.score}</td>
                    <td className="py-3 pr-4">{formatDateTime(submission.catchUtc, event.timezone)}</td>
                    <td className="py-3 pr-4">{statusLabels[submission.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {eventRanked.length === 0 && (
              <p className="py-8 text-center text-gray-600 dark:text-gray-300">
                {tr('No leaderboard entries yet.')}
              </p>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-8">
      <section className="bg-gradient-to-br from-emerald-50 via-white to-sky-50 py-14 dark:from-gray-950 dark:via-gray-900 dark:to-slate-900">
        <div className="container">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-300">
            {tr('Catch Event Tool')}
          </p>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div>
              <h1 className="text-4xl font-bold text-gray-950 dark:text-white">
                {tr('Catch Event Manager')}
              </h1>
              <p className="mt-4 max-w-3xl text-gray-700 dark:text-gray-300">
                {tr('Create PokeMMO catch events, collect manual entries, calculate scores, and publish final leaderboards when staff is ready.')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['events', 'host'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${
                    view === mode
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-gray-300 bg-white text-gray-800 hover:border-emerald-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100'
                  }`}
                  onClick={() => setView(mode)}
                >
                  {mode === 'events' ? tr('Events') : tr('Host')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container pb-16">
        {view === 'host' && (
          <div className="mb-6 flex flex-wrap gap-3">
            {(['create', 'manage'] as HostTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                  hostTab === tab
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-gray-300 bg-white text-gray-800 hover:border-emerald-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100'
                }`}
                onClick={() => {
                  if (tab === 'create') {
                    setEditingEventId('');
                  }
                  setHostTab(tab);
                }}
              >
                {tab === 'create' ? tr('Create') : tr('Manage')}
              </button>
            ))}
          </div>
        )}

        {view === 'host' && hostTab === 'create' && (
          <form className={`${panelClasses} space-y-6`} onSubmit={handleCreateEvent}>
            <div>
              <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{editingEventId ? tr('Edit Event') : tr('Create Event')}</h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {tr('Add each target Pokemon from the species list and give it a positive, negative, or zero point value.')}
              </p>
            </div>
            {!isAuthLoading && !authUser && (
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                {tr('Sign in to create events and access owner-only management tools.')}
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <label className={labelClasses}>
                {tr('Event name')}
                <input className={fieldClasses} value={eventForm.name} onChange={(event) => setEventForm({ ...eventForm, name: event.target.value })} required />
              </label>
              <label className={labelClasses}>
                {tr('Start time')}
                <input className={fieldClasses} type="datetime-local" value={eventForm.startLocal} onChange={(event) => setEventForm({ ...eventForm, startLocal: event.target.value })} required />
              </label>
              <label className={labelClasses}>
                {tr('End time')}
                <input className={fieldClasses} type="datetime-local" value={eventForm.endLocal} onChange={(event) => setEventForm({ ...eventForm, endLocal: event.target.value })} required />
              </label>
              <label className={labelClasses}>
                {tr('Event timezone')}
                <input className={fieldClasses} list="timezone-options" value={eventForm.timezone} onChange={(event) => setEventForm({ ...eventForm, timezone: event.target.value })} required />
              </label>
              <label className={labelClasses}>
                {tr('Region')}
                <input
                  className={fieldClasses}
                  list="catch-event-region-options"
                  value={eventForm.region}
                  onChange={(event) => {
                    const nextRegion = event.target.value;
                    setEventForm({
                      ...eventForm,
                      region: nextRegion,
                      route: CATCH_EVENT_REGIONS.includes(nextRegion as CatchEventRegion)
                        ? ''
                        : eventForm.route,
                    });
                  }}
                  required
                />
                <datalist id="catch-event-region-options">
                  {CATCH_EVENT_REGIONS.map((region) => (
                    <option key={region} value={region} label={translateRegion(region)} />
                  ))}
                </datalist>
              </label>
              <label className={labelClasses}>
                {tr('Route')}
                <input
                  className={fieldClasses}
                  list="catch-event-route-options"
                  value={eventForm.route}
                  onChange={(event) => setEventForm({ ...eventForm, route: event.target.value })}
                  required
                />
                <datalist id="catch-event-route-options">
                  {(CATCH_EVENT_ROUTES_BY_REGION[eventForm.region as CatchEventRegion] || []).map((route) => (
                    <option key={route} value={route} label={translateLocation(route)} />
                  ))}
                </datalist>
              </label>
              <label className={labelClasses}>
                {tr('Number of winners')}
                <input className={fieldClasses} min={1} max={10} type="number" value={eventForm.winnerCount} onChange={(event) => setEventForm({ ...eventForm, winnerCount: event.target.value })} required />
              </label>
            </div>
            {rulesEditor(tr('Target Pokemon And Species Points'), 'species', speciesRows, POKEMON_SPECIES_NAMES)}
            {rulesEditor(tr('Nature Points'), 'nature', natureRows, POKEMON_NATURES)}
            <label className="flex items-start gap-3 text-sm font-medium text-gray-800 dark:text-gray-100">
              <input className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600" type="checkbox" checked={eventForm.useLowestScoreFinalPlace} onChange={(event) => setEventForm({ ...eventForm, useLowestScoreFinalPlace: event.target.checked })} />
              {tr('Reserve the final winner slot for the lowest valid score.')}
            </label>
            {createError && (
              <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:bg-rose-950 dark:text-rose-100">
                {createError}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700">
                {editingEventId ? tr('Update event') : tr('Save event')}
              </button>
              {editingEventId && (
                <button
                  type="button"
                  className={smallButtonClasses}
                  onClick={() => {
                    setEditingEventId('');
                    setCreateError('');
                    setHostTab('manage');
                  }}
                >
                  {tr('Cancel edit')}
                </button>
              )}
            </div>
          </form>
        )}

        {view === 'events' && (
          <div className="space-y-6">
            <div className={panelClasses}>
              <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{tr('Events')}</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <label className={labelClasses}>
                  {tr('Name or keyword')}
                  <input
                    className={fieldClasses}
                    value={eventFilters.search}
                    onChange={(event) => setEventFilters({ ...eventFilters, search: event.target.value })}
                    placeholder={tr('Search events')}
                  />
                </label>
                <label className={labelClasses}>
                  {tr('Target Pokemon')}
                  <input
                    className={fieldClasses}
                    list="event-filter-target-options"
                    value={eventFilters.target}
                    onChange={(event) => setEventFilters({ ...eventFilters, target: event.target.value })}
                    placeholder={tr('Abomasnow, Abra, etc.')}
                  />
                </label>
                <label className={labelClasses}>
                  {tr('Date or time')}
                  <input
                    className={fieldClasses}
                    value={eventFilters.date}
                    onChange={(event) => setEventFilters({ ...eventFilters, date: event.target.value })}
                    placeholder="2026-05-19"
                  />
                </label>
                <label className={labelClasses}>
                  {tr('Host')}
                  <input
                    className={fieldClasses}
                    value={eventFilters.host}
                    onChange={(event) => setEventFilters({ ...eventFilters, host: event.target.value })}
                    placeholder={tr('Host IGN')}
                  />
                </label>
              </div>
              <datalist id="event-filter-target-options">
                {POKEMON_SPECIES_NAMES.map((species) => (
                  <option key={species} value={species} label={translateSpeciesDisplay(species)} />
                ))}
              </datalist>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {filteredEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      activeEvent?.id === event.id
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                        : 'border-gray-200 hover:border-emerald-500 dark:border-gray-800'
                    }`}
                    onClick={() => setActiveEventId(event.id)}
                  >
                    <p className="font-bold text-gray-950 dark:text-white">{event.name}</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      {formatLocalDateTime(event.startLocal)} {tr('to')} {formatLocalDateTime(event.endLocal)} {event.timezone}
                    </p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      {translateLocation(event.route)}, {translateRegion(event.region)} - {tr('Hosted by')} {event.ownerIgn || tr('Team Soju')}
                    </p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {event.targets.map(translateSpeciesDisplay).join(', ')}
                    </p>
                  </button>
                ))}
              </div>
              {filteredEvents.length === 0 && (
                <p className="mt-5 text-sm text-gray-600 dark:text-gray-300">{tr('No events match those filters.')}</p>
              )}
            </div>

            {activeEvent ? renderEventSummary(activeEvent) : (
              <div className={panelClasses}>{tr('Select an event to view details, submit an entry, or open the leaderboard.')}</div>
            )}

            {activeEvent && (
              <>
                <div className="flex flex-wrap gap-3">
                  {(['submission', 'leaderboard'] as EventTab[]).map((tab) => {
                    const isOwnerPreview = Boolean(authUser && activeEvent.ownerUserId === authUser.id);
                    const isUnavailableLeaderboard = tab === 'leaderboard' && !activeEvent.isLeaderboardPublished && !isOwnerPreview;
                    const isUnavailableSubmission = tab === 'submission' && Boolean(getSubmissionDisabledReason(activeEvent));
                    const isUnavailableTab = isUnavailableLeaderboard || isUnavailableSubmission;

                    return (
                      <button
                        key={tab}
                        type="button"
                        disabled={isUnavailableTab}
                        aria-disabled={isUnavailableTab}
                        className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                          isUnavailableTab
                            ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600'
                            : eventTab === tab
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-gray-300 bg-white text-gray-800 hover:border-emerald-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100'
                        }`}
                        onClick={() => {
                          if (!isUnavailableTab) {
                            setEventTab(tab);
                          }
                        }}
                      >
                        {tab === 'submission' ? tr('Submission') : tr('Leaderboard')}
                      </button>
                    );
                  })}
                </div>
                {eventTab === 'submission' && (
                <div className={`${panelClasses} ${getSubmissionDisabledReason(activeEvent) ? 'opacity-60' : ''}`}>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{tr('Player Submission')}</h2>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    {tr("Upload your submission Pokemon's summary, IVs, and catch time as screenshots.")}
                  </p>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    {tr('Browser timezone suggestion:')} {browserTimezone}
                  </p>
                  {getSubmissionDisabledReason(activeEvent) && (
                    <p className="mt-3 rounded-lg bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-600 dark:bg-gray-950 dark:text-gray-300">
                      {getSubmissionDisabledReason(activeEvent)}
                    </p>
                  )}
                </div>
                <form className="space-y-5" onSubmit={handleSubmitEntry}>
                <fieldset className="space-y-5" disabled={Boolean(getSubmissionDisabledReason(activeEvent))}>
                <label className={labelClasses}>
                  {tr('Nature/OT screenshot')}
                  <input
                    className={fieldClasses}
                    type="file"
                    accept="image/*"
                    onChange={async (event) => {
                      const screenshotProofs = await readImageProofs(event.target.files);
                      setOcrMessage('');

                      setSubmissionForm((prev) => ({
                        ...prev,
                        natureOtScreenshot: screenshotProofs[0] ?? null,
                      }));
                    }}
                  />
                </label>
                <label className={labelClasses}>
                  {tr('IVs screenshot')}
                  <input
                    className={fieldClasses}
                    type="file"
                    accept="image/*"
                    onChange={async (event) => {
                      const screenshotProofs = await readImageProofs(event.target.files);
                      setOcrMessage('');

                      setSubmissionForm((prev) => ({
                        ...prev,
                        ivsScreenshot: screenshotProofs[0] ?? null,
                      }));
                    }}
                  />
                </label>
                <label className={labelClasses}>
                  {tr('Catch time/location screenshot')}
                  <input
                    className={fieldClasses}
                    type="file"
                    accept="image/*"
                    onChange={async (event) => {
                      const screenshotProofs = await readImageProofs(event.target.files);
                      setOcrMessage('');

                      setSubmissionForm((prev) => ({
                        ...prev,
                        infoScreenshot: screenshotProofs[0] ?? null,
                      }));
                    }}
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className={smallButtonClasses}
                    type="button"
                    disabled={isOcrLoading || getSubmissionProofs(submissionForm).length < 3}
                    onClick={handleAutofillFromScreenshots}
                  >
                    {isOcrLoading ? tr('Reading screenshots...') : tr('Autofill from screenshots')}
                  </button>
                  {ocrMessage && (
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{ocrMessage}</p>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className={labelClasses}>
                    {tr('Player IGN / OT')}
                    <input className={fieldClasses} value={submissionForm.playerIgn} onChange={(event) => setSubmissionForm({ ...submissionForm, playerIgn: event.target.value })} required />
                  </label>
                  <label className={labelClasses}>
                    {tr('Pokemon species')}
                    <input className={fieldClasses} list="catch-event-targets" value={submissionForm.species} onChange={(event) => setSubmissionForm({ ...submissionForm, species: event.target.value })} required />
                    <datalist id="catch-event-targets">
                      {activeEvent.targets.map((target) => (
                        <option key={target} value={target} label={translateSpeciesDisplay(target)} />
                      ))}
                    </datalist>
                  </label>
                  <label className={labelClasses}>
                    {tr('Nature')}
                    <input className={fieldClasses} list="submission-nature-options" value={submissionForm.nature} onChange={(event) => setSubmissionForm({ ...submissionForm, nature: event.target.value })} required />
                    <datalist id="submission-nature-options">
                      {POKEMON_NATURES.map((nature) => (
                        <option key={nature} value={nature} label={translateNatureDisplay(nature)} />
                      ))}
                    </datalist>
                  </label>
                  <label className={labelClasses}>
                    {tr('Total IV')}
                    <input className={fieldClasses} min={0} max={186} type="number" value={submissionForm.totalIv} onChange={(event) => setSubmissionForm({ ...submissionForm, totalIv: Number(event.target.value) })} required />
                  </label>
                  <label className={labelClasses}>
                    {tr('Catch date/time')}
                    <input className={fieldClasses} type="datetime-local" step={1} value={submissionForm.catchLocal} onChange={(event) => setSubmissionForm({ ...submissionForm, catchLocal: event.target.value })} required />
                  </label>
                  <label className={labelClasses}>
                    {tr('Player timezone')}
                    <input className={fieldClasses} list="timezone-options" value={submissionForm.timezone} onChange={(event) => setSubmissionForm({ ...submissionForm, timezone: event.target.value })} required />
                  </label>
                  <label className={labelClasses}>
                    {tr('Catch region')}
                    <input
                      className={fieldClasses}
                      list="submission-region-options"
                      value={submissionForm.region}
                      onChange={(event) => setSubmissionForm({ ...submissionForm, region: event.target.value, route: '' })}
                      required
                    />
                    <datalist id="submission-region-options">
                      {CATCH_EVENT_REGIONS.map((region) => (
                        <option key={region} value={region} label={translateRegion(region)} />
                      ))}
                    </datalist>
                  </label>
                  <label className={labelClasses}>
                    {tr('Catch route/location')}
                    <input
                      className={fieldClasses}
                      list="submission-route-options"
                      value={submissionForm.route}
                      onChange={(event) => setSubmissionForm({ ...submissionForm, route: event.target.value })}
                      required
                    />
                    <datalist id="submission-route-options">
                      {(CATCH_EVENT_ROUTES_BY_REGION[submissionForm.region as CatchEventRegion] || []).map((route) => (
                        <option key={route} value={route} label={translateLocation(route)} />
                      ))}
                    </datalist>
                  </label>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-950 dark:text-gray-300">
                  <p className="font-semibold text-gray-950 dark:text-white">{tr('Verify before submitting')}</p>
                  <p>
                    {tr('Score preview:')}{' '}
                    {calculateCatchEventScore(
                      { species: submissionForm.species, nature: submissionForm.nature, totalIv: Number(submissionForm.totalIv) },
                      activeEvent
                    )}
                  </p>
                </div>
                <button className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700">
                  {tr('Submit entry')}
                </button>
                {submitMessage && (
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{submitMessage}</p>
                )}
                </fieldset>
                </form>
                </div>
                )}
                {eventTab === 'leaderboard' && (activeEvent.isLeaderboardPublished || (authUser && activeEvent.ownerUserId === authUser.id) ? (
                  renderLeaderboard(activeEvent, Boolean(authUser && activeEvent.ownerUserId === authUser.id))
                ) : (
                  <div className={panelClasses}>
                    <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{tr('Leaderboard')}</h2>
                    <p className="mt-2 text-gray-600 dark:text-gray-300">
                      {tr('This leaderboard is not published yet. Check back after staff confirms the event.')}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {view === 'host' && hostTab === 'manage' && (
          <div className="space-y-6">
            {isAuthLoading ? (
              <div className={panelClasses}>{tr('Checking your Team Soju session...')}</div>
            ) : !authUser ? (
              <div className={panelClasses}>
                <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{tr('Sign In Required')}</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                  {tr('Event management is only available to the account that created the event.')}
                </p>
                <a className="mt-4 inline-flex rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700" href="/auth">
                  {tr('Sign in')}
                </a>
              </div>
            ) : activeEvent ? (
              <>
                <div className={panelClasses}>
                  <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{tr('Manage Events')}</h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {ownedEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        className={`rounded-lg border p-4 text-left transition-colors ${
                          activeEvent.id === event.id
                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                            : 'border-gray-200 hover:border-emerald-500 dark:border-gray-800'
                        }`}
                        onClick={() => setActiveEventId(event.id)}
                      >
                        <p className="font-bold text-gray-950 dark:text-white">{event.name}</p>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          {formatLocalDateTime(event.startLocal)} {tr('to')} {formatLocalDateTime(event.endLocal)} {event.timezone}
                        </p>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          {translateLocation(event.route)}, {translateRegion(event.region)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className={panelClasses}>
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{activeEvent.name}</h2>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        {formatLocalDateTime(activeEvent.startLocal)} {tr('to')} {formatLocalDateTime(activeEvent.endLocal)} {activeEvent.timezone}
                      </p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {translateLocation(activeEvent.route)}, {translateRegion(activeEvent.region)}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <span className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                          activeEvent.isLeaderboardPublished
                            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
                        }`}>
                          {activeEvent.isLeaderboardPublished ? tr('Leaderboard published') : tr('Leaderboard unpublished')}
                        </span>
                        <button
                          type="button"
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                          disabled={activeEvent.isLeaderboardPublished}
                          onClick={() => updateLeaderboardPublished(activeEvent.id, true)}
                        >
                          {tr('Publish leaderboard')}
                        </button>
                        {activeEvent.isLeaderboardPublished && (
                          <button
                            type="button"
                            className={smallButtonClasses}
                            onClick={() => updateLeaderboardPublished(activeEvent.id, false)}
                          >
                            {tr('Unpublish')}
                          </button>
                        )}
                        <button
                          type="button"
                          className={activeEvent.submissionsClosed ? smallButtonClasses : 'rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700'}
                          onClick={() => updateSubmissionsClosed(activeEvent.id, !activeEvent.submissionsClosed)}
                        >
                          {activeEvent.submissionsClosed ? tr('Reopen submissions') : tr('Close submissions')}
                        </button>
                        <button type="button" className={smallButtonClasses} onClick={() => loadEventIntoForm(activeEvent)}>
                          {tr('Duplicate setup')}
                        </button>
                        <button type="button" className={smallButtonClasses} onClick={() => loadEventIntoForm(activeEvent, 'edit')}>
                          {tr('Edit event')}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700"
                          onClick={() => deleteEvent(activeEvent)}
                        >
                          {tr('Delete event')}
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-3 text-sm">
                      <label className={labelClasses}>
                        {tr('Submission link')}
                        <input className={fieldClasses} readOnly value={makeToolUrl('events', activeEvent.id)} />
                      </label>
                      <label className={labelClasses}>
                        {tr('Event link')}
                        <input className={fieldClasses} readOnly value={makeToolUrl('events', activeEvent.id)} />
                      </label>
                    </div>
                  </div>
                  {createdEventId === activeEvent.id && (
                    <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      {tr('Event saved. Share the submit link when entries open.')}
                    </p>
                  )}
                </div>
                <div className={panelClasses}>
                  <h3 className="text-xl font-bold text-gray-950 dark:text-white">{tr('Review Queue')}</h3>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[1120px] text-left text-sm">
                      <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800">
                        <tr>
                          <th className="py-3 pr-4">{tr('Player')}</th>
                          <th className="py-3 pr-4">{tr('Entry')}</th>
                          <th className="py-3 pr-4">{tr('Proof')}</th>
                          <th className="py-3 pr-4">{tr('Score')}</th>
                          <th className="py-3 pr-4">{tr('Location')}</th>
                          <th className="py-3 pr-4">{tr('Catch UTC')}</th>
                          <th className="py-3 pr-4">{tr('Flags')}</th>
                          <th className="py-3 pr-4">{tr('Status')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {activeSubmissions.map((submission) => (
                          <tr key={submission.id}>
                            <td className="py-3 pr-4 font-semibold text-gray-950 dark:text-white">{submission.playerIgn}</td>
                            <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">
                              {translateSpeciesDisplay(submission.species)}, {translateNatureDisplay(submission.nature)}, {submission.totalIv} {tr('IV')}
                              <span className="block text-xs">{submission.screenshotNames.length} {tr('screenshot(s)')}</span>
                            </td>
                            <td className="py-3 pr-4">
                              {submission.screenshotProofs?.length ? (
                                <div className="flex max-w-48 gap-2 overflow-x-auto pb-1">
                                  {submission.screenshotProofs.map((proof, index) => (
                                    <button
                                      key={`${submission.id}-${proof.name || proof.fileName}-${index}`}
                                      type="button"
                                      className="group block shrink-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                                      onClick={() => setSelectedProof(proof)}
                                      title={`${tr('Open proof')} ${proof.name || proof.fileName || tr('Screenshot proof')}`}
                                      aria-label={`${tr('Open proof')} ${proof.name || proof.fileName || tr('Screenshot proof')}`}
                                    >
                                      <img
                                        className="h-16 w-16 rounded-lg border border-gray-200 object-cover transition-opacity group-hover:opacity-80 dark:border-gray-700"
                                        src={proof.dataUrl || proof.url}
                                        alt={`${submission.playerIgn} ${tr('proof')} ${index + 1}`}
                                      />
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400">
                                  {submission.screenshotNames.length
                                    ? submission.screenshotNames.join(', ')
                                    : tr('None')}
                                </span>
                              )}
                            </td>
                            <td className="py-3 pr-4 font-bold">{submission.score}</td>
                            <td className="py-3 pr-4">
                              {submission.route ? translateLocation(submission.route) : tr('Unknown')}, {submission.region ? translateRegion(submission.region) : tr('Unknown')}
                            </td>
                            <td className="py-3 pr-4">{formatDateTime(submission.catchUtc)}</td>
                            <td className="py-3 pr-4">{submission.flags.length ? submission.flags.join('; ') : tr('None')}</td>
                            <td className="py-3 pr-4">
                              <select className={fieldClasses} value={submission.status} onChange={(event) => updateSubmissionStatus(submission.id, event.target.value as CatchEventStatus)}>
                                {Object.entries(statusLabels).map(([status, label]) => (
                                  <option key={status} value={status}>{label}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {activeSubmissions.length === 0 && <p className="py-8 text-center text-gray-600 dark:text-gray-300">{tr('No submissions yet.')}</p>}
                  </div>
                </div>
              </>
            ) : (
              <div className={panelClasses}>{tr('No events owned by your account yet.')}</div>
            )}
          </div>
        )}

        <datalist id="timezone-options">
          {timezoneOptions.map((timezone) => (
            <option key={timezone.value} value={timezone.value}>
              {timezone.label}
            </option>
          ))}
        </datalist>
      </section>
      {selectedProof && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={selectedProof.name || selectedProof.fileName || tr('Screenshot proof')}
          onClick={() => setSelectedProof(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl rounded-lg bg-white p-4 shadow-2xl dark:bg-gray-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {selectedProof.name || selectedProof.fileName || tr('Screenshot proof')}
              </p>
              <button
                type="button"
                className={smallButtonClasses}
                onClick={() => setSelectedProof(null)}
              >
                {tr('Close')}
              </button>
            </div>
            <img
              className="max-h-[78vh] w-full rounded-lg object-contain"
              src={selectedProof.dataUrl || selectedProof.url}
              alt={selectedProof.name || selectedProof.fileName || tr('Screenshot proof')}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CatchEventManager;
