import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { POKEMON_NATURES, calculateCatchEventScore, slugifyEventName, validateCatchEventSubmission } from '../utils/catchEventScoring';
import type { CatchEventConfig, CatchEventStatus, CatchEventSubmission } from '../utils/catchEventScoring';
import { CATCH_EVENT_REGIONS, type CatchEventRegion } from '../utils/catchEventLocations';
import { getClientLocale, getTranslations, type Locale } from '../i18n';
import { POKEMON_SPECIES_NAME_SET, POKEMON_SPECIES_NAMES } from '../utils/pokemonSpecies';
import { EventCreateForm } from './catch-events/EventCreateForm';
import { EventsView } from './catch-events/EventsView';
import { HostManageView } from './catch-events/HostManageView';
import { ProofModal } from './catch-events/ProofModal';
import { DEFAULT_TIMEZONE, defaultEventForm, defaultNatureRows, defaultSpeciesRows, defaultSubmissionForm, fetchJson, formatLocalDateTime, getBrowserTimezone, getDefaultEventWindow, getSubmissionDisabledReason, getSubmissionProofs, getTimezoneOptions, getTodayLocalDate, normalizeHostTab, normalizeQueryView, pickRandomItems, rowsFromRules, splitRules, statusLabelKeys, type AuthUser, type CatchEventOcrResult, type EventTab, type HostTab, type LegacyViewMode, type RuleRow, type ScreenshotProof, type ViewMode } from './catch-events/shared';
type Props = { apiBaseUrl: string; initialView?: LegacyViewMode; locale?: Locale | string };
const NATURE_SET = new Set<string>(POKEMON_NATURES.map((nature) => nature.toLowerCase()));
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
    setEventForm((current) => {
      const defaultWindow = getDefaultEventWindow();
      return {
        ...current,
        startLocal: current.startLocal || defaultWindow.startLocal,
        endLocal: current.endLocal || defaultWindow.endLocal,
        eventDate: current.eventDate || getTodayLocalDate(),
        timezone: current.timezone || detectedTimezone,
      };
    });
    setSpeciesRows((current) => {
      if (current.some((row) => row.name.trim())) {
        return current;
      }
      const [bonusSpecies, neutralSpecies, penaltySpecies] = pickRandomItems(POKEMON_SPECIES_NAMES, 3);
      return [
        { id: `species-${Date.now().toString(36)}-bonus`, name: bonusSpecies, points: '5' },
        { id: `species-${Date.now().toString(36)}-neutral`, name: neutralSpecies, points: '0' },
        { id: `species-${Date.now().toString(36)}-penalty`, name: penaltySpecies, points: '-5' },
      ];
    });
    setNatureRows((current) => {
      if (current.some((row) => row.name.trim())) {
        return current;
      }
      const [bonusNature, penaltyNature] = pickRandomItems(POKEMON_NATURES, 2);
      return [
        { id: `nature-${Date.now().toString(36)}-bonus`, name: bonusNature, points: '5' },
        { id: `nature-${Date.now().toString(36)}-penalty`, name: penaltyNature, points: '-5' },
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
  const activeSubmissions = useMemo(
    () => submissions.filter((submission) => submission.eventId === activeEvent?.id),
    [activeEvent?.id, submissions]
  );
  const showEventSearch = view === 'events' && !activeEvent?.isPrivate;
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
  function validateEventForm() {
    const speciesNames = speciesRows.map((row) => row.name.trim()).filter(Boolean);
    const natureNames = natureRows.map((row) => row.name.trim()).filter(Boolean);
    if (!authUser) return tr('Sign in before creating a catch event so the admin dashboard can be tied to your account.');
    if (!eventForm.name.trim()) return tr('Event name is required.');
    if (!eventForm.region || !CATCH_EVENT_REGIONS.includes(eventForm.region as CatchEventRegion)) return tr('Choose a valid region.');
    if (!eventForm.route.trim()) return tr('Choose a route.');
    if (speciesNames.length === 0) return tr('Add at least one target Pokemon.');
    if (new Set(speciesNames.map((name) => name.toLowerCase())).size !== speciesNames.length) return tr('Each target Pokemon can only be added once.');
    const invalidSpecies = speciesNames.find((name) => !POKEMON_SPECIES_NAME_SET.has(name.toLowerCase()));
    if (invalidSpecies) return `${invalidSpecies} ${tr('is not in the supported Pokemon species list.')}`;
    const invalidSpeciesPoints = speciesRows.find(
      (row) => row.name.trim() && (row.points === '' || row.points === '-' || !Number.isFinite(Number(row.points)))
    );
    if (invalidSpeciesPoints) {
      return activeLocale === 'zh'
        ? `${tr('Enter a numeric point value for')}${invalidSpeciesPoints.name}.`
        : `${tr('Enter a numeric point value for')} ${invalidSpeciesPoints.name}.`;
    }
    const invalidNature = natureNames.find((name) => !NATURE_SET.has(name.toLowerCase()));
    if (invalidNature) return `${invalidNature} ${tr('is not a valid Pokemon nature.')}`;
    const invalidNaturePoints = natureRows.find(
      (row) => row.name.trim() && (row.points === '' || row.points === '-' || !Number.isFinite(Number(row.points)))
    );
    if (invalidNaturePoints) {
      return activeLocale === 'zh'
        ? `${tr('Enter a numeric point value for')}${invalidNaturePoints.name}.`
        : `${tr('Enter a numeric point value for')} ${invalidNaturePoints.name}.`;
    }
    if (new Date(eventForm.endLocal) <= new Date(eventForm.startLocal)) return tr('End time must be after start time.');
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
      const response = await fetchJson<CatchEventConfig>(
        `${normalizedApiBaseUrl}/catch-events${editingEventId ? `/${encodeURIComponent(editingEventId)}` : ''}`,
        {
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
            isPrivate: eventForm.isPrivate,
            isLeaderboardPublished: false,
          }),
        }
      );
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
      screenshotProofs: screenshotProofs.map((proof) => ({
        name: proof.name || proof.fileName || tr('screenshot.png'),
        dataUrl: proof.dataUrl,
        url: proof.url,
        fileName: proof.fileName,
      })),
    };
    const validation = validateCatchEventSubmission(input, activeEvent, browserTimezone);
    try {
      const response = await fetchJson<CatchEventSubmission>(
        `${normalizedApiBaseUrl}/catch-events/${encodeURIComponent(activeEvent.id)}/submissions`,
        {
          method: 'POST',
          body: JSON.stringify({
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
          }),
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
      setSubmissionForm((current) => ({ ...current, ...updates }));
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
      isPrivate: event.isPrivate ?? true,
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
                {tr('Create PokeMMO catch events, collect submissions, automatically calculate scores, and publish results.')}
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
          <EventCreateForm
            editingEventId={editingEventId}
            isAuthLoading={isAuthLoading}
            authUser={authUser}
            eventForm={eventForm}
            speciesRows={speciesRows}
            natureRows={natureRows}
            createError={createError}
            tr={tr}
            translateSpeciesDisplay={translateSpeciesDisplay}
            translateNatureDisplay={translateNatureDisplay}
            translateRegion={translateRegion}
            translateLocation={translateLocation}
            setEventForm={setEventForm}
            setSpeciesRows={setSpeciesRows}
            setNatureRows={setNatureRows}
            setEditingEventId={setEditingEventId}
            setCreateError={setCreateError}
            setHostTab={setHostTab}
            onSubmit={handleCreateEvent}
          />
        )}

        {view === 'events' && (
          <EventsView
            activeEvent={activeEvent}
            filteredEvents={filteredEvents}
            submissions={submissions}
            eventFilters={eventFilters}
            eventTab={eventTab}
            showEventSearch={showEventSearch}
            authUser={authUser}
            submissionForm={submissionForm}
            submitMessage={submitMessage}
            ocrMessage={ocrMessage}
            isOcrLoading={isOcrLoading}
            browserTimezone={browserTimezone}
            statusLabels={statusLabels}
            tr={tr}
            translateSpeciesDisplay={translateSpeciesDisplay}
            translateNatureDisplay={translateNatureDisplay}
            translateRegion={translateRegion}
            translateLocation={translateLocation}
            setEventFilters={setEventFilters}
            setActiveEventId={setActiveEventId}
            setEventTab={setEventTab}
            setSubmissionForm={setSubmissionForm}
            setOcrMessage={setOcrMessage}
            onSubmitEntry={handleSubmitEntry}
            onAutofillFromScreenshots={handleAutofillFromScreenshots}
          />
        )}

        {view === 'host' && hostTab === 'manage' && (
          <HostManageView
            isAuthLoading={isAuthLoading}
            authUser={authUser}
            activeEvent={activeEvent}
            ownedEvents={ownedEvents}
            activeSubmissions={activeSubmissions}
            createdEventId={createdEventId}
            statusLabels={statusLabels}
            tr={tr}
            translateSpeciesDisplay={translateSpeciesDisplay}
            translateNatureDisplay={translateNatureDisplay}
            translateRegion={translateRegion}
            translateLocation={translateLocation}
            setActiveEventId={setActiveEventId}
            setSelectedProof={setSelectedProof}
            updateSubmissionStatus={updateSubmissionStatus}
            updateLeaderboardPublished={updateLeaderboardPublished}
            updateSubmissionsClosed={updateSubmissionsClosed}
            loadEventIntoForm={loadEventIntoForm}
            deleteEvent={deleteEvent}
          />
        )}

        <datalist id="timezone-options">
          {timezoneOptions.map((timezone) => (
            <option key={timezone.value} value={timezone.value}>
              {timezone.label}
            </option>
          ))}
        </datalist>
      </section>
      <ProofModal proof={selectedProof} tr={tr} onClose={() => setSelectedProof(null)} />
    </div>
  );
}; export default CatchEventManager;
