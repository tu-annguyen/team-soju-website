import React from 'react';
import type { FormEvent } from 'react';
import type {
  CatchEventConfig,
  CatchEventStatus,
  CatchEventSubmission,
} from '../../utils/catchEventScoring';
import type { Locale } from '../../i18n';
import { POKEMON_SPECIES_NAMES } from '../../utils/pokemonSpecies';
import { EventLeaderboard, EventSummary } from './EventDisplay';
import { EventSubmissionPanel } from './EventSubmissionPanel';
import {
  fieldClasses,
  formatEventTimeForBrowser,
  getSubmissionDisabledReason,
  labelClasses,
  makeToolUrl,
  panelClasses,
  smallButtonClasses,
  type AuthUser,
  type EventTab,
  type SubmissionForm,
} from './shared';

type EventFilters = {
  search: string;
  target: string;
  date: string;
  host: string;
};

type Props = {
  isLoading: boolean;
  activeEvent: CatchEventConfig | undefined;
  filteredEvents: CatchEventConfig[];
  submissions: CatchEventSubmission[];
  eventFilters: EventFilters;
  eventTab: EventTab;
  showEventSearch: boolean;
  authUser: AuthUser | null;
  manageableEventIds: Set<string>;
  submissionForm: SubmissionForm;
  submitMessage: string;
  submitMessageTone: 'success' | 'error';
  ocrMessage: string;
  isOcrLoading: boolean;
  browserTimezone: string;
  locale: Locale | string;
  statusLabels: Record<CatchEventStatus, string>;
  tr: (text: string) => string;
  translateSpeciesDisplay: (species: string) => string;
  translateNatureDisplay: (nature: string) => string;
  translateRegion: (region: string) => string;
  translateLocation: (location: string) => string;
  setEventFilters: React.Dispatch<React.SetStateAction<EventFilters>>;
  setActiveEventId: (eventId: string) => void;
  setEventTab: (tab: EventTab) => void;
  setSubmissionForm: React.Dispatch<React.SetStateAction<SubmissionForm>>;
  setOcrMessage: (message: string) => void;
  onSubmitEntry: (event: FormEvent<HTMLFormElement>) => void;
  onAutofillFromScreenshots: () => void;
};

export function EventsView({
  isLoading,
  activeEvent,
  filteredEvents,
  submissions,
  eventFilters,
  eventTab,
  showEventSearch,
  authUser,
  manageableEventIds,
  submissionForm,
  submitMessage,
  submitMessageTone,
  ocrMessage,
  isOcrLoading,
  browserTimezone,
  locale,
  statusLabels,
  tr,
  translateSpeciesDisplay,
  translateNatureDisplay,
  translateRegion,
  translateLocation,
  setEventFilters,
  setActiveEventId,
  setEventTab,
  setSubmissionForm,
  setOcrMessage,
  onSubmitEntry,
  onAutofillFromScreenshots,
}: Props) {
  if (isLoading) {
    return <EventsSkeleton showSearch={showEventSearch} />;
  }

  return (
    <div className="space-y-6">
      {showEventSearch && (
        <div className={panelClasses}>
          <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{tr('Public Events')}</h2>
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
              <div
                key={event.id}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  activeEvent?.id === event.id
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                    : 'border-gray-200 hover:border-emerald-500 dark:border-gray-800'
                }`}
              >
                <button type="button" className="block w-full text-left" onClick={() => setActiveEventId(event.id)}>
                  <p className="font-bold text-gray-950 dark:text-white">{event.name}</p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {formatEventTimeForBrowser(event.startLocal, event.timezone, browserTimezone, locale)} {tr('to')} {formatEventTimeForBrowser(event.endLocal, event.timezone, browserTimezone, locale)}
                  </p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {translateLocation(event.route)}, {translateRegion(event.region)} - {tr('Hosted by')} {event.ownerIgn || tr('Team Soju')}
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {event.targets.map(translateSpeciesDisplay).join(', ')}
                  </p>
                </button>
                {(manageableEventIds.has(event.id) || (authUser && event.ownerUserId === authUser.id)) && (
                  <a className={`mt-3 inline-flex ${smallButtonClasses}`} href={makeToolUrl('host', event.id, 'manage')}>
                    {tr('Manage')}
                  </a>
                )}
              </div>
            ))}
          </div>
          {filteredEvents.length === 0 && (
            <p className="mt-5 text-sm text-gray-600 dark:text-gray-300">{tr('No events match those filters.')}</p>
          )}
        </div>
      )}
      {!showEventSearch && activeEvent?.isPrivate && (
        <div className="flex justify-end">
          <a className={smallButtonClasses} href={makeToolUrl('events')}>
            {tr('Search for Public events')}
          </a>
        </div>
      )}

      {activeEvent ? (
        <EventSummary
          event={activeEvent}
          browserTimezone={browserTimezone}
          locale={locale}
          tr={tr}
          translateSpeciesDisplay={translateSpeciesDisplay}
          translateNatureDisplay={translateNatureDisplay}
          translateRegion={translateRegion}
          translateLocation={translateLocation}
        />
      ) : (
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
            <EventSubmissionPanel
              activeEvent={activeEvent}
              submissionForm={submissionForm}
              submitMessage={submitMessage}
              submitMessageTone={submitMessageTone}
              ocrMessage={ocrMessage}
              isOcrLoading={isOcrLoading}
              browserTimezone={browserTimezone}
              tr={tr}
              translateSpeciesDisplay={translateSpeciesDisplay}
              translateNatureDisplay={translateNatureDisplay}
              translateRegion={translateRegion}
              translateLocation={translateLocation}
              setSubmissionForm={setSubmissionForm}
              setOcrMessage={setOcrMessage}
              onSubmit={onSubmitEntry}
              onAutofill={onAutofillFromScreenshots}
            />
          )}
          {eventTab === 'leaderboard' && (activeEvent.isLeaderboardPublished || (authUser && activeEvent.ownerUserId === authUser.id) ? (
            <EventLeaderboard
              event={activeEvent}
              submissions={submissions}
              showUnpublished={Boolean(authUser && activeEvent.ownerUserId === authUser.id)}
              statusLabels={statusLabels}
              locale={locale}
              tr={tr}
              translateSpeciesDisplay={translateSpeciesDisplay}
              translateNatureDisplay={translateNatureDisplay}
            />
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
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800 ${className}`} />;
}

function EventsSkeleton({ showSearch }: { showSearch: boolean }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading events">
      {showSearch && (
        <div className={panelClasses}>
          <SkeletonBlock className="h-8 w-48" />
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item}>
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="mt-2 h-10 w-full" />
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                <SkeletonBlock className="h-5 w-2/3" />
                <SkeletonBlock className="mt-3 h-4 w-full" />
                <SkeletonBlock className="mt-2 h-4 w-3/4" />
                <SkeletonBlock className="mt-3 h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      )}
      <div className={panelClasses}>
        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
          <div>
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="mt-3 h-8 w-2/3" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <div key={item}>
                  <SkeletonBlock className="h-3 w-20" />
                  <SkeletonBlock className="mt-2 h-5 w-40" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <SkeletonBlock className="h-4 w-28" />
            <div className="mt-3 flex flex-wrap gap-2">
              {[0, 1, 2].map((item) => <SkeletonBlock key={item} className="h-7 w-20" />)}
            </div>
            <SkeletonBlock className="mt-5 h-4 w-40" />
            <SkeletonBlock className="mt-3 h-7 w-48" />
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <SkeletonBlock className="h-10 w-24" />
        <SkeletonBlock className="h-10 w-28" />
      </div>
      <div className={panelClasses}>
        <SkeletonBlock className="h-7 w-48" />
        <SkeletonBlock className="mt-4 h-4 w-2/3" />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item}>
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="mt-2 h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
