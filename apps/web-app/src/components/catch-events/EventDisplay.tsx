import React from 'react';
import {
  rankCatchEventSubmissions,
  selectCatchEventWinners,
} from '../../utils/catchEventScoring';
import type {
  CatchEventConfig,
  CatchEventRule,
  CatchEventStatus,
  CatchEventSubmission,
} from '../../utils/catchEventScoring';
import type { Locale } from '../../i18n';
import {
  formatDateTime,
  formatEventTimeForBrowser,
  formatLocalDateTime,
  getOrdinal,
  getSubmissionDisabledReason,
  panelClasses,
} from './shared';

type Translate = (text: string) => string;
type ValueTranslator = (value: string) => string;

type EventDisplayProps = {
  event: CatchEventConfig;
  browserTimezone: string;
  locale: Locale | string;
  tr: Translate;
  translateSpeciesDisplay: ValueTranslator;
  translateNatureDisplay: ValueTranslator;
  translateRegion: ValueTranslator;
  translateLocation: ValueTranslator;
};

function RuleList({
  title,
  bonuses,
  penalties,
  translateValue,
  tr,
}: {
  title: string;
  bonuses: CatchEventRule[];
  penalties: CatchEventRule[];
  translateValue: ValueTranslator;
  tr: Translate;
}) {
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
}

export function EventSummary({
  event,
  browserTimezone,
  locale,
  tr,
  translateSpeciesDisplay,
  translateNatureDisplay,
  translateRegion,
  translateLocation,
}: EventDisplayProps) {
  return (
    <div className={panelClasses}>
      <div className="grid gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            {tr('Selected Event')}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">{event.name}</h2>
          <div className="mt-4 grid gap-3 text-sm text-gray-700 dark:text-gray-300 lg:grid-cols-3 sm:grid-cols-2">
            <p>
              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{tr('Starts')}</span>
              {formatEventTimeForBrowser(event.startLocal, event.timezone, browserTimezone, locale)}
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                {tr('Event time:')} {formatLocalDateTime(event.startLocal, locale)} {event.timezone}
              </span>
            </p>
            <p>
              <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{tr('Ends')}</span>
              {formatEventTimeForBrowser(event.endLocal, event.timezone, browserTimezone, locale)}
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                {tr('Event time:')} {formatLocalDateTime(event.endLocal, locale)} {event.timezone}
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
          <div className="mt-4 grid grid-gap-3 lg:grid-cols-3 sm:grid-cols-2">
            <div className="my-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{tr('Target Pokemon')}</p>
              {event.targets.map((target) => (
                <span key={target} className="mr-2 rounded-lg bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                  {translateSpeciesDisplay(target)}
                </span>
              ))}
            </div>
            <div className="my-2 flex flex-wrap gap-2">
              <RuleList
                title={tr('Species Bonuses & Penalties')}
                bonuses={event.speciesBonuses}
                penalties={event.speciesPenalties}
                translateValue={translateSpeciesDisplay}
                tr={tr}
              />
            </div>
            <div className="my-2 flex flex-wrap gap-2">
              <RuleList
                title={tr('Nature Bonuses & Penalties')}
                bonuses={event.natureBonuses}
                penalties={event.naturePenalties}
                translateValue={translateNatureDisplay}
                tr={tr}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type LeaderboardProps = {
  event: CatchEventConfig;
  submissions: CatchEventSubmission[];
  showUnpublished: boolean;
  statusLabels: Record<CatchEventStatus, string>;
  locale: Locale | string;
  tr: Translate;
  translateSpeciesDisplay: ValueTranslator;
  translateNatureDisplay: ValueTranslator;
};

export function EventLeaderboard({
  event,
  submissions,
  showUnpublished,
  statusLabels,
  locale,
  tr,
  translateSpeciesDisplay,
  translateNatureDisplay,
}: LeaderboardProps) {
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
                {formatDateTime(winner.catchUtc, event.timezone, locale)}
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
                  <td className="py-3 pr-4">{formatDateTime(submission.catchUtc, event.timezone, locale)}</td>
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
}
