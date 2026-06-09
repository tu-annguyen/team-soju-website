import type {
  AuthUser,
  FeebasLeaderboardEntry,
  LeaderboardColumn,
  LeaderboardSortKey,
  LeaderboardSortState,
} from './shared';

export type SortIconVariant = 'sort' | 'sort-up' | 'sort-down';

export const DEFAULT_LEADERBOARD_SORT: LeaderboardSortState = {
  key: 'rank',
  direction: 'asc',
};
export const LEADERBOARD_VISIBLE_LIMIT = 10;

function compareLeaderboardNumbers(left: number | null, right: number | null) {
  const leftValue = Number.isFinite(left || NaN) ? Number(left) : 0;
  const rightValue = Number.isFinite(right || NaN) ? Number(right) : 0;

  return leftValue - rightValue;
}

function compareLeaderboardDefault(left: FeebasLeaderboardEntry, right: FeebasLeaderboardEntry) {
  return (
    compareLeaderboardNumbers(right.allTimeContributionScore, left.allTimeContributionScore)
    || compareLeaderboardNumbers(right.verifiedDiscoveries, left.verifiedDiscoveries)
    || compareLeaderboardNumbers(right.feebasUptimeCreatedMinutes, left.feebasUptimeCreatedMinutes)
    || compareLeaderboardNumbers(right.confirmations, left.confirmations)
    || compareLeaderboardNumbers(right.searchCoverage, left.searchCoverage)
    || left.ign.localeCompare(right.ign)
  );
}

function compareLeaderboardEntries(
  left: FeebasLeaderboardEntry,
  right: FeebasLeaderboardEntry,
  sortKey: LeaderboardSortKey
) {
  if (sortKey === 'rank') return compareLeaderboardDefault(left, right);
  if (sortKey === 'ign') return left.ign.localeCompare(right.ign);

  return (
    compareLeaderboardNumbers(left[sortKey], right[sortKey])
    || compareLeaderboardDefault(left, right)
  );
}

export function sortLeaderboardEntries(entries: FeebasLeaderboardEntry[], sort: LeaderboardSortState) {
  const directionMultiplier = sort.direction === 'desc' ? -1 : 1;

  return [...entries].sort((left, right) => (
    compareLeaderboardEntries(left, right, sort.key) * directionMultiplier
  ));
}

export function isCurrentUserLeaderboardEntry(entry: FeebasLeaderboardEntry, authUser: AuthUser | null) {
  return Boolean(authUser && entry.userId === authUser.id);
}

export function getSortIconVariant(columnKey: LeaderboardSortKey, sort: LeaderboardSortState): SortIconVariant {
  if (sort.key !== columnKey) return 'sort';
  return sort.direction === 'desc' ? 'sort-down' : 'sort-up';
}

export function getNextLeaderboardSort(
  column: LeaderboardColumn,
  currentSort: LeaderboardSortState
): LeaderboardSortState {
  if (currentSort.key !== column.key) {
    return {
      key: column.key,
      direction: column.defaultDirection,
    };
  }

  return {
    key: column.key,
    direction: currentSort.direction === 'asc' ? 'desc' : 'asc',
  };
}

export function getLeaderboardNotables(entries: FeebasLeaderboardEntry[]) {
  const entriesWithFinds = entries.filter((entry) => entry.verifiedDiscoveries > 0);
  const fastestFinder = [...entriesWithFinds]
    .filter((entry) => Number.isFinite(entry.fastestFindSeconds || NaN) && (entry.fastestFindSeconds || 0) > 0)
    .sort((left, right) => (left.fastestFindSeconds || 0) - (right.fastestFindSeconds || 0))[0] || null;
  const longestStreak = [...entries]
    .filter((entry) => Number.isFinite(entry.currentStreak) && entry.currentStreak > 0)
    .sort((left, right) => (
      compareLeaderboardNumbers(right.currentStreak, left.currentStreak)
      || compareLeaderboardDefault(left, right)
    ))[0] || null;
  const mostPersistent = [...entriesWithFinds]
    .filter((entry) => Number.isFinite(entry.mostPersistentChecks || NaN) && (entry.mostPersistentChecks || 0) > 0)
    .sort((left, right) => (right.mostPersistentChecks || 0) - (left.mostPersistentChecks || 0))[0] || null;

  return {
    fastestFinder,
    longestStreak,
    mostPersistent,
  };
}

export function formatScore(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatUptime(minutes: number, locale: string) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0m';

  if (minutes < 60) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(minutes)}m`;
  }

  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(minutes / 60)}h`;
}

export function formatPercent(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDuration(seconds: number | null, fallback: string) {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return fallback;

  if (seconds < 60) return `${Math.round(seconds)}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

export function formatNullableCount(value: number | null, fallback: string) {
  return Number.isFinite(value || NaN) && value ? String(value) : fallback;
}
