import { useMemo } from 'react';
import type React from 'react';
import { LeaderboardHeaderTooltip } from './LeaderboardHeaderTooltip';
import { LoadingPlaceholder } from './LoadingPlaceholder';
import {
  formatDuration,
  formatNullableCount,
  formatPercent,
  formatScore,
  formatUptime,
  getLeaderboardNotables,
  getNextLeaderboardSort,
  getSortIconVariant,
  isCurrentUserLeaderboardEntry,
  LEADERBOARD_VISIBLE_LIMIT,
  sortLeaderboardEntries,
  type SortIconVariant,
} from './leaderboard';
import type {
  AuthUser,
  FeebasBoard,
  FeebasCheckerMessages,
  FeebasLeaderboardEntry,
  LeaderboardColumn,
  LeaderboardSortState,
} from './shared';
import { formatCopy, LEADERBOARD_SIGN_IN_CTA_CLASSES } from './shared';

function SortIcon({ variant }: { variant: SortIconVariant }) {
  if (variant === 'sort-up') {
    return (
      <svg aria-hidden="true" className="h-3 w-3 shrink-0 fill-current" data-sort-icon={variant} viewBox="0 0 16 16">
        <path d="M4 10h8L8 4l-4 6z" />
      </svg>
    );
  }

  if (variant === 'sort-down') {
    return (
      <svg aria-hidden="true" className="h-3 w-3 shrink-0 fill-current" data-sort-icon={variant} viewBox="0 0 16 16">
        <path d="M4 6h8l-4 6-4-6z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-3 w-3 shrink-0 fill-current" data-sort-icon={variant} viewBox="0 0 16 16">
      <path d="M4 6h8L8 2 4 6z" />
      <path d="M4 10h8l-4 4-4-4z" />
    </svg>
  );
}

function getLeaderboardColumns(messages: FeebasCheckerMessages): LeaderboardColumn[] {
  return [
    { key: 'ign', label: messages.leaderboard.columns.trainer, tooltip: messages.leaderboard.tooltips.trainer, defaultDirection: 'asc' },
    { key: 'weeklyContributionScore', label: messages.leaderboard.columns.weeklyScore, tooltip: messages.leaderboard.tooltips.weeklyScore, defaultDirection: 'desc' },
    { key: 'allTimeContributionScore', label: messages.leaderboard.columns.allTimeScore, tooltip: messages.leaderboard.tooltips.allTimeScore, defaultDirection: 'desc' },
    { key: 'verifiedDiscoveries', label: messages.leaderboard.columns.discoveries, tooltip: messages.leaderboard.tooltips.discoveries, defaultDirection: 'desc' },
    { key: 'feebasUptimeCreatedMinutes', label: messages.leaderboard.columns.uptime, tooltip: messages.leaderboard.tooltips.uptime, defaultDirection: 'desc' },
    { key: 'confirmations', label: messages.leaderboard.columns.confirmations, tooltip: messages.leaderboard.tooltips.confirmations, defaultDirection: 'desc' },
    { key: 'searchCoverage', label: messages.leaderboard.columns.coverage, tooltip: messages.leaderboard.tooltips.coverage, defaultDirection: 'desc' },
    { key: 'reportAccuracy', label: messages.leaderboard.columns.accuracy, tooltip: messages.leaderboard.tooltips.accuracy, defaultDirection: 'desc' },
    { key: 'efficiency', label: messages.leaderboard.columns.efficiency, tooltip: messages.leaderboard.tooltips.efficiency, defaultDirection: 'desc' },
    { key: 'currentStreak', label: messages.leaderboard.columns.streak, tooltip: messages.leaderboard.tooltips.streak, defaultDirection: 'desc' },
  ];
}

type Props = {
  activeLocale: string;
  authHref: string;
  authUser: AuthUser | null;
  board: FeebasBoard | null;
  isAuthLoading: boolean;
  leaderboardEntries: FeebasLeaderboardEntry[];
  leaderboardSort: LeaderboardSortState;
  loading: boolean;
  messages: FeebasCheckerMessages;
  onLeaderboardSortChange: React.Dispatch<React.SetStateAction<LeaderboardSortState>>;
};

export function LeaderboardPanel({
  activeLocale,
  authHref,
  authUser,
  board,
  isAuthLoading,
  leaderboardEntries,
  leaderboardSort,
  loading,
  messages,
  onLeaderboardSortChange,
}: Props) {
  const leaderboardColumns = useMemo(() => getLeaderboardColumns(messages), [messages]);
  const sortedLeaderboardEntries = useMemo(
    () => sortLeaderboardEntries(leaderboardEntries, leaderboardSort),
    [leaderboardEntries, leaderboardSort]
  );
  const currentUserLeaderboardEntry = authUser
    ? leaderboardEntries.find((entry) => isCurrentUserLeaderboardEntry(entry, authUser)) || null
    : null;
  const isCurrentUserOutsideTopTen = Boolean(
    currentUserLeaderboardEntry && currentUserLeaderboardEntry.rank > LEADERBOARD_VISIBLE_LIMIT
  );
  const displayedLeaderboardEntries = useMemo(() => {
    if (!authUser || !isCurrentUserOutsideTopTen) return sortedLeaderboardEntries;

    const currentUserEntry = sortedLeaderboardEntries.find((entry) => isCurrentUserLeaderboardEntry(entry, authUser));
    if (!currentUserEntry) return sortedLeaderboardEntries;

    return [
      ...sortedLeaderboardEntries.filter((entry) => !isCurrentUserLeaderboardEntry(entry, authUser)),
      currentUserEntry,
    ];
  }, [authUser, isCurrentUserOutsideTopTen, sortedLeaderboardEntries]);
  const leaderboardNotables = useMemo(() => getLeaderboardNotables(leaderboardEntries), [leaderboardEntries]);

  return (
    <section className="card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{messages.leaderboard.heading}</h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            {messages.leaderboard.description}
          </p>
        </div>
        {!isAuthLoading && !authUser ? (
          <a href={authHref} className={`${LEADERBOARD_SIGN_IN_CTA_CLASSES} sm:shrink-0`}>
            {messages.general.signInToTrackLeaderboardStats}
          </a>
        ) : null}
      </div>

      {loading && !board ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <LoadingPlaceholder key={`leaderboard-placeholder-${index}`} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : leaderboardEntries.length ? (
        <>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[980px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-semibold uppercase">
                    <LeaderboardHeaderTooltip tooltip={messages.leaderboard.tooltips.rank} align="left">
                      <span tabIndex={0} className="inline-flex cursor-help outline-none">
                        {messages.leaderboard.columns.rank}
                      </span>
                    </LeaderboardHeaderTooltip>
                  </th>
                  {leaderboardColumns.map((column) => (
                    <th key={column.key} className="px-3 py-2 font-semibold">
                      <LeaderboardHeaderTooltip tooltip={column.tooltip}>
                        <button
                          type="button"
                          onClick={() => onLeaderboardSortChange((currentSort) => getNextLeaderboardSort(column, currentSort))}
                          className="inline-flex items-center gap-2 text-left font-semibold uppercase text-slate-500 outline-none transition hover:text-slate-900 focus-visible:text-slate-900 dark:text-slate-400 dark:hover:text-white dark:focus-visible:text-white"
                        >
                          <span>{column.label}</span>
                          <SortIcon variant={getSortIconVariant(column.key, leaderboardSort)} />
                        </button>
                      </LeaderboardHeaderTooltip>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {displayedLeaderboardEntries.map((entry, index) => {
                  const isCurrentUserEntry = isCurrentUserLeaderboardEntry(entry, authUser);
                  const displayRank = isCurrentUserEntry && entry.rank > LEADERBOARD_VISIBLE_LIMIT
                    ? entry.rank
                    : index + 1;

                  return (
                    <tr
                      key={entry.userId}
                      className={`text-slate-700 dark:text-slate-200 ${
                        isCurrentUserEntry
                          ? 'relative border-l-4 border-primary-500 bg-primary-50 text-primary-950 ring-1 ring-primary-200 dark:bg-primary-950/40 dark:text-primary-100 dark:ring-primary-700/70'
                          : ''
                      }`}
                    >
                      <td className="px-3 py-3 font-semibold text-slate-900 dark:text-white">#{displayRank}</td>
                      <td className="px-3 py-3 font-semibold text-slate-900 dark:text-white">{entry.ign}</td>
                      <td className="px-3 py-3">{formatScore(entry.weeklyContributionScore, activeLocale)}</td>
                      <td className="px-3 py-3">{formatScore(entry.allTimeContributionScore, activeLocale)}</td>
                      <td className="px-3 py-3">{entry.verifiedDiscoveries}</td>
                      <td className="px-3 py-3">{formatUptime(entry.feebasUptimeCreatedMinutes, activeLocale)}</td>
                      <td className="px-3 py-3">{entry.confirmations}</td>
                      <td className="px-3 py-3">{entry.searchCoverage}</td>
                      <td className="px-3 py-3">{formatPercent(entry.reportAccuracy, activeLocale)}</td>
                      <td className="px-3 py-3">{formatPercent(entry.efficiency, activeLocale)}</td>
                      <td className="px-3 py-3">{entry.currentStreak}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5">
            <h4 className="text-sm font-semibold uppercase text-slate-500 dark:text-slate-400">
              {messages.leaderboard.notables.heading}
            </h4>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <LeaderboardNotable label={messages.leaderboard.notables.fastestFinder}>
                {leaderboardNotables.fastestFinder
                  ? formatCopy(messages.leaderboard.notables.fastestValue, {
                    ign: leaderboardNotables.fastestFinder.ign,
                    value: formatDuration(leaderboardNotables.fastestFinder.fastestFindSeconds, messages.leaderboard.notables.noData),
                  })
                  : messages.leaderboard.notables.noData}
              </LeaderboardNotable>
              <LeaderboardNotable label={messages.leaderboard.notables.longestStreak}>
                {leaderboardNotables.longestStreak
                  ? formatCopy(messages.leaderboard.notables.streakValue, {
                    ign: leaderboardNotables.longestStreak.ign,
                    value: formatNullableCount(leaderboardNotables.longestStreak.currentStreak, messages.leaderboard.notables.noData),
                  })
                  : messages.leaderboard.notables.noData}
              </LeaderboardNotable>
              <LeaderboardNotable label={messages.leaderboard.notables.mostPersistent}>
                {leaderboardNotables.mostPersistent
                  ? formatCopy(messages.leaderboard.notables.checksValue, {
                    ign: leaderboardNotables.mostPersistent.ign,
                    value: formatNullableCount(leaderboardNotables.mostPersistent.mostPersistentChecks, messages.leaderboard.notables.noData),
                  })
                  : messages.leaderboard.notables.noData}
              </LeaderboardNotable>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
          {messages.leaderboard.emptyState}
        </p>
      )}
    </section>
  );
}

function LeaderboardNotable({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
        {children}
      </p>
    </div>
  );
}
