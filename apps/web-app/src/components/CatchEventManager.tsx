import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  POKEMON_NATURES,
  calculateCatchEventScore,
  rankCatchEventSubmissions,
  selectCatchEventWinners,
  slugifyEventName,
  validateCatchEventSubmission,
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
import { POKEMON_SPECIES_NAME_SET, POKEMON_SPECIES_NAMES } from '../utils/pokemonSpecies';

type ViewMode = 'create' | 'submit' | 'admin' | 'leaderboard';
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
  initialView?: ViewMode;
};

const DEFAULT_TIMEZONE = 'America/New_York';
const NATURE_SET = new Set<string>(POKEMON_NATURES.map((nature) => nature.toLowerCase()));

const statusLabels: Record<CatchEventStatus, string> = {
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

function makeToolUrl(view: ViewMode, eventId?: string) {
  if (typeof window === 'undefined') {
    return '/tools/catch-events';
  }

  const url = new URL('/tools/catch-events', window.location.origin);
  url.searchParams.set('view', view);

  if (eventId) {
    url.searchParams.set('event', eventId);
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

const CatchEventManager = ({ apiBaseUrl, initialView = 'create' }: Props) => {
  const normalizedApiBaseUrl = useMemo(() => apiBaseUrl.replace(/\/+$/, ''), [apiBaseUrl]);
  const [events, setEvents] = useState<CatchEventConfig[]>([]);
  const [submissions, setSubmissions] = useState<CatchEventSubmission[]>([]);
  const [view, setView] = useState<ViewMode>(initialView);
  const [activeEventId, setActiveEventId] = useState('');
  const [eventForm, setEventForm] = useState(defaultEventForm);
  const [speciesRows, setSpeciesRows] = useState<RuleRow[]>(defaultSpeciesRows);
  const [natureRows, setNatureRows] = useState<RuleRow[]>(defaultNatureRows);
  const [submissionForm, setSubmissionForm] = useState(defaultSubmissionForm);
  const [browserTimezone, setBrowserTimezone] = useState(DEFAULT_TIMEZONE);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [createdEventId, setCreatedEventId] = useState('');
  const [createError, setCreateError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [ocrMessage, setOcrMessage] = useState('');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [hasExplicitEventQuery, setHasExplicitEventQuery] = useState(false);
  const [selectedProof, setSelectedProof] = useState<ScreenshotProof | null>(null);
  const timezoneOptions = useMemo(getTimezoneOptions, []);
  const loadEventDetails = useCallback(async (eventId: string, nextView = view) => {
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
    const queryView = params.get('view') as ViewMode | null;
    const queryEvent = params.get('event') || '';
    const detectedTimezone = getBrowserTimezone();

    setActiveEventId(queryEvent);
    setHasExplicitEventQuery(Boolean(queryEvent));
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

    if (queryView && ['create', 'submit', 'admin', 'leaderboard'].includes(queryView)) {
      setView(queryView);
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
          const event = await loadEventDetails(queryEvent, queryView === 'leaderboard' ? 'leaderboard' : view);
          if (isMounted) {
            setActiveEventId(event?.id || queryEvent);
          }
          return;
        }

        const listPath = queryView === 'leaderboard'
          ? '/catch-events?published=true'
          : '/catch-events';
        const response = await fetchJson<CatchEventConfig[]>(`${normalizedApiBaseUrl}${listPath}`);

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
    if (!authUser || view !== 'admin') {
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
  }, [activeEventId, authUser, loadEventDetails, normalizedApiBaseUrl, view]);

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
    if (view !== 'admin' || !activeEventId || !authUser) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      loadEventDetails(activeEventId, 'admin').catch((error) => {
        console.error('Error refreshing catch event submissions:', error);
      });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [activeEventId, authUser, loadEventDetails, view]);

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
  const eventOptions = view === 'admin' ? ownedEvents : events;
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
  const activeSubmissions = useMemo(
    () => submissions.filter((submission) => submission.eventId === activeEvent?.id),
    [activeEvent?.id, submissions]
  );
  const rankedSubmissions = useMemo(
    () => rankCatchEventSubmissions(activeSubmissions),
    [activeSubmissions]
  );
  const winners = useMemo(
    () => (activeEvent ? selectCatchEventWinners(activeEvent, activeSubmissions) : []),
    [activeEvent, activeSubmissions]
  );
  const publicEvents = useMemo(
    () => events.filter((event) => event.isLeaderboardPublished),
    [events]
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
      return 'Sign in before creating a catch event so the admin dashboard can be tied to your account.';
    }

    if (!eventForm.name.trim()) {
      return 'Event name is required.';
    }

    if (!eventForm.region || !CATCH_EVENT_REGIONS.includes(eventForm.region as CatchEventRegion)) {
      return 'Choose a valid region.';
    }

    if (!eventForm.route.trim()) {
      return 'Choose a route.';
    }

    if (speciesNames.length === 0) {
      return 'Add at least one target Pokemon.';
    }

    if (new Set(speciesNames.map((name) => name.toLowerCase())).size !== speciesNames.length) {
      return 'Each target Pokemon can only be added once.';
    }

    const invalidSpecies = speciesNames.find((name) => !POKEMON_SPECIES_NAME_SET.has(name.toLowerCase()));
    if (invalidSpecies) {
      return `${invalidSpecies} is not in the supported Pokemon species list.`;
    }

    const invalidSpeciesPoints = speciesRows.find(
      (row) => row.name.trim() && (row.points === '' || row.points === '-' || !Number.isFinite(Number(row.points)))
    );
    if (invalidSpeciesPoints) {
      return `Enter a numeric point value for ${invalidSpeciesPoints.name}.`;
    }

    const invalidNature = natureNames.find((name) => !NATURE_SET.has(name.toLowerCase()));
    if (invalidNature) {
      return `${invalidNature} is not a valid Pokemon nature.`;
    }

    const invalidNaturePoints = natureRows.find(
      (row) => row.name.trim() && (row.points === '' || row.points === '-' || !Number.isFinite(Number(row.points)))
    );
    if (invalidNaturePoints) {
      return `Enter a numeric point value for ${invalidNaturePoints.name}.`;
    }

    if (new Date(eventForm.endLocal) <= new Date(eventForm.startLocal)) {
      return 'End time must be after start time.';
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
    const idBase = slugifyEventName(eventForm.name);
    const existingIds = new Set(events.map((storedEvent) => storedEvent.id));
    const id = existingIds.has(idBase) ? `${idBase}-${Date.now().toString(36)}` : idBase;
    try {
      const response = await fetchJson<CatchEventConfig>(`${normalizedApiBaseUrl}/catch-events`, {
        method: 'POST',
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
      setCreateError('');
      setView('admin');
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create event.');
    }
  }

  async function handleSubmitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeEvent) {
      setSubmitMessage('Create or select an event before submitting an entry.');
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
      screenshotNames: screenshotProofs.map((proof) => proof.name || proof.fileName || 'screenshot.png'),
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
        name: proof.name || proof.fileName || 'screenshot.png',
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
          ? 'Entry submitted. Your previous submission was overwritten.'
          : validation.flags.length
            ? 'Entry submitted and marked Needs Review.'
            : 'Entry submitted successfully.'
      );
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : 'Failed to submit entry.');
    }
  }

  async function handleAutofillFromScreenshots() {
    const screenshotEntries = getSubmissionProofs(submissionForm);
    const screenshots = screenshotEntries
      .map(({ role, proof }) => ({
        name: proof.name || proof.fileName || 'screenshot.png',
        contentType: proof.dataUrl?.match(/^data:([^;,]+)/)?.[1] || 'image/png',
        role,
        dataUrl: proof.dataUrl,
      }))
      .filter((proof): proof is { name: string; contentType: string; role: 'nature-ot' | 'ivs' | 'information'; dataUrl: string } => Boolean(proof.dataUrl));

    if (screenshots.length < 3) {
      setOcrMessage('Upload the Nature/OT, IVs, and Information screenshots before using autofill.');
      return;
    }

    setIsOcrLoading(true);
    setOcrMessage('Reading screenshots...');

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
      const locationNote = result.location ? ` Route read as ${result.location}; choose the matching region before submitting.` : '';
      setOcrMessage(
        filledFields
          ? `Autofill filled ${filledFields} field${filledFields === 1 ? '' : 's'}. Verify before submitting.${locationNote}${warnings}`
          : `OCR ran, but did not find fields confidently enough to autofill.${locationNote}${warnings}`
      );
    } catch (error) {
      setOcrMessage(error instanceof Error ? error.message : 'Failed to read screenshots.');
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

  function loadEventIntoForm(event: CatchEventConfig) {
    setEventForm({
      name: `${event.name} Copy`,
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
    setView('create');
  }

  const eventSelector = eventOptions.length > 0 && (
    <label className={labelClasses}>
      Event
      <select
        className={fieldClasses}
        value={activeEvent?.id ?? ''}
        onChange={(event) => setActiveEventId(event.target.value)}
      >
        {eventOptions.map((catchEvent) => (
          <option key={catchEvent.id} value={catchEvent.id}>
            {catchEvent.name}
          </option>
        ))}
      </select>
    </label>
  );

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
            Use positive points for bonuses, negative points for penalties, and 0 for neutral scoring.
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
          Add
        </button>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
            <label className={labelClasses}>
              {kind === 'species' ? 'Pokemon species' : 'Nature'}
              <input
                className={fieldClasses}
                list={kind === 'species' ? 'pokemon-species-options' : 'nature-options'}
                value={row.name}
                onChange={(event) => updateRuleRow(kind, row.id, { name: event.target.value })}
                required
              />
            </label>
            <label className={labelClasses}>
              Points
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
              Remove
            </button>
          </div>
        ))}
      </div>
      <datalist id={kind === 'species' ? 'pokemon-species-options' : 'nature-options'}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
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
            This leaderboard is not published yet. Check back after staff confirms the event.
          </p>
        </div>
      );
    }

    return (
      <>
        <div className={panelClasses}>
          <h2 className="text-2xl font-bold text-gray-950 dark:text-white">Winners</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {eventWinners.map((winner, index) => (
              <div key={winner.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  {getOrdinal(index + 1)}
                  {event.useLowestScoreFinalPlace && index === event.winnerCount - 1
                    ? ' - Lowest score'
                    : ''}
                </p>
                <p className="mt-1 text-xl font-bold text-gray-950 dark:text-white">
                  {winner.playerIgn} - {winner.score} points
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {winner.species}, {winner.nature}, caught at{' '}
                  {formatDateTime(winner.catchUtc, event.timezone)}
                </p>
              </div>
            ))}
          </div>
          {eventWinners.length === 0 && (
            <p className="mt-4 text-gray-600 dark:text-gray-300">No valid or reviewable entries yet.</p>
          )}
        </div>
        <div className={panelClasses}>
          <h3 className="text-xl font-bold text-gray-950 dark:text-white">Leaderboard</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800">
                <tr>
                  <th className="py-3 pr-4">Rank</th>
                  <th className="py-3 pr-4">Player</th>
                  <th className="py-3 pr-4">Pokemon</th>
                  <th className="py-3 pr-4">Score</th>
                  <th className="py-3 pr-4">Catch Time</th>
                  <th className="py-3 pr-4">Status</th>
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
                      {submission.species}, {submission.nature}
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
                No leaderboard entries yet.
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
            Catch Event Tool
          </p>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div>
              <h1 className="text-4xl font-bold text-gray-950 dark:text-white">
                Catch Event Manager
              </h1>
              <p className="mt-4 max-w-3xl text-gray-700 dark:text-gray-300">
                Create PokeMMO catch events, collect manual entries, calculate scores, and publish
                final leaderboards when staff is ready.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
              {(['create', 'submit', 'admin', 'leaderboard'] as ViewMode[]).map((mode) => (
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
                  {mode === 'create' ? 'Create' : mode === 'submit' ? 'Submit' : mode === 'admin' ? 'Admin' : 'Leaderboard'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container pb-16">
        {eventOptions.length > 0 && view !== 'create' && !(view === 'leaderboard' && !hasExplicitEventQuery) && (
          <div className="mb-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            {eventSelector}
            {activeEvent && view === 'admin' && (
              <button type="button" className={smallButtonClasses} onClick={() => loadEventIntoForm(activeEvent)}>
                Duplicate setup
              </button>
            )}
          </div>
        )}

        {view === 'create' && (
          <form className={`${panelClasses} space-y-6`} onSubmit={handleCreateEvent}>
            <div>
              <h2 className="text-2xl font-bold text-gray-950 dark:text-white">Create Event</h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Add each target Pokemon from the species list and give it a positive, negative, or zero point value.
              </p>
            </div>
            {!isAuthLoading && !authUser && (
              <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                Sign in to create events and access the owner-only admin dashboard.
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <label className={labelClasses}>
                Event name
                <input className={fieldClasses} value={eventForm.name} onChange={(event) => setEventForm({ ...eventForm, name: event.target.value })} required />
              </label>
              <label className={labelClasses}>
                Start time
                <input className={fieldClasses} type="datetime-local" value={eventForm.startLocal} onChange={(event) => setEventForm({ ...eventForm, startLocal: event.target.value })} required />
              </label>
              <label className={labelClasses}>
                End time
                <input className={fieldClasses} type="datetime-local" value={eventForm.endLocal} onChange={(event) => setEventForm({ ...eventForm, endLocal: event.target.value })} required />
              </label>
              <label className={labelClasses}>
                Event timezone
                <input className={fieldClasses} list="timezone-options" value={eventForm.timezone} onChange={(event) => setEventForm({ ...eventForm, timezone: event.target.value })} required />
              </label>
              <label className={labelClasses}>
                Region
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
                    <option key={region} value={region} />
                  ))}
                </datalist>
              </label>
              <label className={labelClasses}>
                Route
                <input
                  className={fieldClasses}
                  list="catch-event-route-options"
                  value={eventForm.route}
                  onChange={(event) => setEventForm({ ...eventForm, route: event.target.value })}
                  required
                />
                <datalist id="catch-event-route-options">
                  {(CATCH_EVENT_ROUTES_BY_REGION[eventForm.region as CatchEventRegion] || []).map((route) => (
                    <option key={route} value={route} />
                  ))}
                </datalist>
              </label>
              <label className={labelClasses}>
                Number of winners
                <input className={fieldClasses} min={1} max={10} type="number" value={eventForm.winnerCount} onChange={(event) => setEventForm({ ...eventForm, winnerCount: event.target.value })} required />
              </label>
            </div>
            {rulesEditor('Target Pokemon And Species Points', 'species', speciesRows, POKEMON_SPECIES_NAMES)}
            {rulesEditor('Nature Points', 'nature', natureRows, POKEMON_NATURES)}
            <label className="flex items-start gap-3 text-sm font-medium text-gray-800 dark:text-gray-100">
              <input className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600" type="checkbox" checked={eventForm.useLowestScoreFinalPlace} onChange={(event) => setEventForm({ ...eventForm, useLowestScoreFinalPlace: event.target.checked })} />
              Reserve the final winner slot for the lowest valid score.
            </label>
            <datalist id="timezone-options">
              {timezoneOptions.map((timezone) => (
                <option key={timezone.value} value={timezone.value}>
                  {timezone.label}
                </option>
              ))}
            </datalist>
            {createError && (
              <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:bg-rose-950 dark:text-rose-100">
                {createError}
              </p>
            )}
            <button className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700">
              Save event
            </button>
          </form>
        )}

        {view === 'submit' && (
          <div className={panelClasses}>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-950 dark:text-white">Player Submission</h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Upload your submission Pokemon's summary, IVs, and catch time as screenshots.
              </p>
              {activeEvent ? (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Browser timezone suggestion: {browserTimezone}
                </p>
              ) : (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  No catch event exists in this browser yet.
                </p>
              )}
            </div>
            {activeEvent && (
              <form className="space-y-5" onSubmit={handleSubmitEntry}>
                <label className={labelClasses}>
                  Nature/OT screenshot
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
                  IVs screenshot
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
                  Catch time/location screenshot
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
                    {isOcrLoading ? 'Reading screenshots...' : 'Autofill from screenshots'}
                  </button>
                  {ocrMessage && (
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{ocrMessage}</p>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className={labelClasses}>
                    Player IGN / OT
                    <input className={fieldClasses} value={submissionForm.playerIgn} onChange={(event) => setSubmissionForm({ ...submissionForm, playerIgn: event.target.value })} required />
                  </label>
                  <label className={labelClasses}>
                    Pokemon species
                    <input className={fieldClasses} list="catch-event-targets" value={submissionForm.species} onChange={(event) => setSubmissionForm({ ...submissionForm, species: event.target.value })} required />
                    <datalist id="catch-event-targets">
                      {activeEvent.targets.map((target) => <option key={target} value={target} />)}
                    </datalist>
                  </label>
                  <label className={labelClasses}>
                    Nature
                    <input className={fieldClasses} list="submission-nature-options" value={submissionForm.nature} onChange={(event) => setSubmissionForm({ ...submissionForm, nature: event.target.value })} required />
                    <datalist id="submission-nature-options">
                      {POKEMON_NATURES.map((nature) => <option key={nature} value={nature} />)}
                    </datalist>
                  </label>
                  <label className={labelClasses}>
                    Total IV
                    <input className={fieldClasses} min={0} max={186} type="number" value={submissionForm.totalIv} onChange={(event) => setSubmissionForm({ ...submissionForm, totalIv: Number(event.target.value) })} required />
                  </label>
                  <label className={labelClasses}>
                    Catch date/time
                    <input className={fieldClasses} type="datetime-local" step={1} value={submissionForm.catchLocal} onChange={(event) => setSubmissionForm({ ...submissionForm, catchLocal: event.target.value })} required />
                  </label>
                  <label className={labelClasses}>
                    Player timezone
                    <input className={fieldClasses} list="timezone-options" value={submissionForm.timezone} onChange={(event) => setSubmissionForm({ ...submissionForm, timezone: event.target.value })} required />
                  </label>
                  <label className={labelClasses}>
                    Catch region
                    <input
                      className={fieldClasses}
                      list="submission-region-options"
                      value={submissionForm.region}
                      onChange={(event) => setSubmissionForm({ ...submissionForm, region: event.target.value, route: '' })}
                      required
                    />
                    <datalist id="submission-region-options">
                      {CATCH_EVENT_REGIONS.map((region) => (
                        <option key={region} value={region} />
                      ))}
                    </datalist>
                  </label>
                  <label className={labelClasses}>
                    Catch route/location
                    <input
                      className={fieldClasses}
                      list="submission-route-options"
                      value={submissionForm.route}
                      onChange={(event) => setSubmissionForm({ ...submissionForm, route: event.target.value })}
                      required
                    />
                    <datalist id="submission-route-options">
                      {(CATCH_EVENT_ROUTES_BY_REGION[submissionForm.region as CatchEventRegion] || []).map((route) => (
                        <option key={route} value={route} />
                      ))}
                    </datalist>
                  </label>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-950 dark:text-gray-300">
                  <p className="font-semibold text-gray-950 dark:text-white">Verify before submitting</p>
                  <p>
                    Score preview:{' '}
                    {calculateCatchEventScore(
                      { species: submissionForm.species, nature: submissionForm.nature, totalIv: Number(submissionForm.totalIv) },
                      activeEvent
                    )}
                  </p>
                </div>
                <button className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700">
                  Submit entry
                </button>
                {submitMessage && (
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{submitMessage}</p>
                )}
              </form>
            )}
          </div>
        )}

        {view === 'admin' && (
          <div className="space-y-6">
            {isAuthLoading ? (
              <div className={panelClasses}>Checking your Team Soju session...</div>
            ) : !authUser ? (
              <div className={panelClasses}>
                <h2 className="text-2xl font-bold text-gray-950 dark:text-white">Sign In Required</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                  The admin dashboard is only available to the account that created the event.
                </p>
                <a className="mt-4 inline-flex rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700" href="/auth">
                  Sign in
                </a>
              </div>
            ) : activeEvent ? (
              <>
                <div className={panelClasses}>
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{activeEvent.name}</h2>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        {formatLocalDateTime(activeEvent.startLocal)} to {formatLocalDateTime(activeEvent.endLocal)} {activeEvent.timezone}
                      </p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {activeEvent.route}, {activeEvent.region}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <span className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                          activeEvent.isLeaderboardPublished
                            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
                        }`}>
                          {activeEvent.isLeaderboardPublished ? 'Leaderboard published' : 'Leaderboard unpublished'}
                        </span>
                        <button
                          type="button"
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                          disabled={activeEvent.isLeaderboardPublished}
                          onClick={() => updateLeaderboardPublished(activeEvent.id, true)}
                        >
                          Publish leaderboard
                        </button>
                        {activeEvent.isLeaderboardPublished && (
                          <button
                            type="button"
                            className={smallButtonClasses}
                            onClick={() => updateLeaderboardPublished(activeEvent.id, false)}
                          >
                            Unpublish
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-3 text-sm">
                      <label className={labelClasses}>
                        Submission link
                        <input className={fieldClasses} readOnly value={makeToolUrl('submit', activeEvent.id)} />
                      </label>
                      <label className={labelClasses}>
                        Public leaderboard link
                        <input className={fieldClasses} readOnly value={makeToolUrl('leaderboard', activeEvent.id)} />
                      </label>
                    </div>
                  </div>
                  {createdEventId === activeEvent.id && (
                    <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      Event saved. Share the submit link when entries open.
                    </p>
                  )}
                </div>
                <div className={panelClasses}>
                  <h3 className="text-xl font-bold text-gray-950 dark:text-white">Review Queue</h3>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[1120px] text-left text-sm">
                      <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800">
                        <tr>
                          <th className="py-3 pr-4">Player</th>
                          <th className="py-3 pr-4">Entry</th>
                          <th className="py-3 pr-4">Proof</th>
                          <th className="py-3 pr-4">Score</th>
                          <th className="py-3 pr-4">Location</th>
                          <th className="py-3 pr-4">Catch UTC</th>
                          <th className="py-3 pr-4">Flags</th>
                          <th className="py-3 pr-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {activeSubmissions.map((submission) => (
                          <tr key={submission.id}>
                            <td className="py-3 pr-4 font-semibold text-gray-950 dark:text-white">{submission.playerIgn}</td>
                            <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">
                              {submission.species}, {submission.nature}, {submission.totalIv} IV
                              <span className="block text-xs">{submission.screenshotNames.length} screenshot(s)</span>
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
                                      title={`Open ${proof.name || proof.fileName || 'screenshot'}`}
                                      aria-label={`Open ${proof.name || proof.fileName || 'screenshot'}`}
                                    >
                                      <img
                                        className="h-16 w-16 rounded-lg border border-gray-200 object-cover transition-opacity group-hover:opacity-80 dark:border-gray-700"
                                        src={proof.dataUrl || proof.url}
                                        alt={`${submission.playerIgn} proof ${index + 1}`}
                                      />
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400">
                                  {submission.screenshotNames.length
                                    ? submission.screenshotNames.join(', ')
                                    : 'None'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 pr-4 font-bold">{submission.score}</td>
                            <td className="py-3 pr-4">
                              {submission.route || 'Unknown'}, {submission.region || 'Unknown'}
                            </td>
                            <td className="py-3 pr-4">{formatDateTime(submission.catchUtc)}</td>
                            <td className="py-3 pr-4">{submission.flags.length ? submission.flags.join('; ') : 'None'}</td>
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
                    {activeSubmissions.length === 0 && <p className="py-8 text-center text-gray-600 dark:text-gray-300">No submissions yet.</p>}
                  </div>
                </div>
              </>
            ) : (
              <div className={panelClasses}>No events owned by your account yet.</div>
            )}
          </div>
        )}

        {view === 'leaderboard' && (
          <div className="space-y-6">
            {hasExplicitEventQuery && activeEvent ? (
              renderLeaderboard(activeEvent, Boolean(authUser && activeEvent.ownerUserId === authUser.id))
            ) : (
              <div className={panelClasses}>
                <h2 className="text-2xl font-bold text-gray-950 dark:text-white">Past Catch Events</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {publicEvents.map((event) => (
                    <a key={event.id} className="rounded-lg border border-gray-200 p-4 hover:border-emerald-500 dark:border-gray-800" href={makeToolUrl('leaderboard', event.id)}>
                      <p className="font-bold text-gray-950 dark:text-white">{event.name}</p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {formatLocalDateTime(event.startLocal)} {event.timezone}
                      </p>
                    </a>
                  ))}
                </div>
                {publicEvents.length === 0 && (
                  <p className="mt-4 text-gray-600 dark:text-gray-300">No published catch event leaderboards yet.</p>
                )}
              </div>
            )}
          </div>
        )}
      </section>
      {selectedProof && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={selectedProof.name || selectedProof.fileName || 'Screenshot proof'}
          onClick={() => setSelectedProof(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl rounded-lg bg-white p-4 shadow-2xl dark:bg-gray-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {selectedProof.name || selectedProof.fileName || 'Screenshot proof'}
              </p>
              <button
                type="button"
                className={smallButtonClasses}
                onClick={() => setSelectedProof(null)}
              >
                Close
              </button>
            </div>
            <img
              className="max-h-[78vh] w-full rounded-lg object-contain"
              src={selectedProof.dataUrl || selectedProof.url}
              alt={selectedProof.name || selectedProof.fileName || 'Screenshot proof'}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CatchEventManager;
