import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getClientLocale, getLocaleParamPath, getTranslations } from '../i18n';
import type { Locale } from '../i18n';

type TileStatus = 'unchecked' | 'checked' | 'pending' | 'confirmed';

type FeebasTile = {
  tileId: string;
  label: string;
  row: number;
  col: number;
  status: TileStatus;
  voteCounts: {
    checked: number;
    pending: number;
    confirmed: number;
  };
  totalVotes: number;
  currentUserVote: TileStatus;
};

type FeebasActivityEntry = {
  id: number;
  tileId: string;
  tileLabel: string;
  actionType: string;
  previousStatus: string | null;
  nextStatus: TileStatus | null;
  actorName: string | null;
  createdAt: string;
};

type FeebasLeaderboardEntry = {
  rank: number;
  userId: string;
  ign: string;
  verifiedDiscoveries: number;
  feebasUptimeCreatedMinutes: number;
  confirmations: number;
  searchCoverage: number;
  weeklyContributionScore: number;
  allTimeContributionScore: number;
  fastestFindSeconds: number | null;
  earlyScoutSeconds: number | null;
  efficiency: number;
  reportAccuracy: number;
  currentStreak: number;
  mostPersistentChecks: number | null;
};

type FeebasLeaderboard = {
  location: string;
  generatedAt: string;
  weeklySince: string;
  sort?: {
    by: LeaderboardSortKey;
    direction: LeaderboardSortDirection;
  };
  sortOptions?: {
    key: LeaderboardSortKey;
    defaultDirection: LeaderboardSortDirection;
  }[];
  entries: FeebasLeaderboardEntry[];
};

type FeebasBoard = {
  location: string;
  displayName: string;
  description: string;
  cycleStart: string;
  cycleEnd: string;
  serverTime: string;
  resetIntervalMinutes: number;
  requiresDistinctConfirmation: boolean;
  confirmedTileId: string | null;
  isLocked: boolean;
  previousConfirmedTiles?: {
    tileId: string;
    confirmations: number;
  }[];
  layout: {
    rows: number;
    cols: number;
  };
  activity: FeebasActivityEntry[];
  leaderboard?: FeebasLeaderboard;
  tiles: FeebasTile[];
};

type BoardResponse = {
  success: boolean;
  data: FeebasBoard;
  message?: string;
};

type AuthUser = {
  id: string;
  email: string;
  ign: string;
};

type AuthResponse = {
  success: boolean;
  data?: AuthUser | null;
  message?: string;
};

type Props = {
  apiBaseUrl: string;
  location?: string;
  locale?: Locale | string;
};

type LocationOption = {
  id: string;
  tabLabel: string;
  displayName: string;
  terrain: readonly (readonly string[])[];
};

type BoardDisplayMode = 'voting' | 'heatmap';
type LeaderboardSortKey =
  | 'rank'
  | 'ign'
  | 'weeklyContributionScore'
  | 'allTimeContributionScore'
  | 'verifiedDiscoveries'
  | 'feebasUptimeCreatedMinutes'
  | 'confirmations'
  | 'searchCoverage'
  | 'reportAccuracy'
  | 'efficiency'
  | 'currentStreak';
type LeaderboardSortDirection = 'asc' | 'desc';
type LeaderboardSortState = {
  key: LeaderboardSortKey;
  direction: LeaderboardSortDirection;
};
type LeaderboardColumn = {
  key: LeaderboardSortKey;
  label: string;
  tooltip: string;
  defaultDirection: LeaderboardSortDirection;
};
type SortIconVariant = 'sort' | 'sort-up' | 'sort-down';
type TooltipPosition = {
  top: number;
  left: number;
  width: number;
  arrowLeft: number;
};

const DEFAULT_LOCATION = 'route-119-main';
const DEFAULT_LEADERBOARD_SORT: LeaderboardSortState = {
  key: 'rank',
  direction: 'asc',
};
const ACTIVITY_PAGE_SIZE = 5;
const CLIENT_ID_STORAGE_KEY = 'feebas-tile-checker-client-id';
const ACTIVE_LOCATION_STORAGE_KEY = 'feebas-tile-checker-active-location';
const BOARD_MIN_TILE_SIZE_PX = 40;
const BOARD_MIN_WIDTH_PX = 768;
const TOOLTIP_MAX_WIDTH_PX = 288;
const TOOLTIP_VIEWPORT_MARGIN_PX = 8;
const TOOLTIP_ARROW_MARGIN_PX = 16;
const LEADERBOARD_SIGN_IN_CTA_CLASSES =
  'inline-flex items-center justify-center rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600';
const ROUTE_119_MAIN_TERRAIN = [
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'rock', 'rock', 'water', 'water', 'rock', 'rock', 'water', 'water', 'rock', 'rock', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'rock', 'rock', 'water', 'water', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'bank', 'bank', 'bank', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['grass', 'grass', 'grass', 'grass', 'bank', 'bank', 'bank', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'water'],
  ['rock', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['rock', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass'],
  ['rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['rock', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
] as const;
const MT_CORONET_TERRAIN = [
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'water', 'water'],
  ['water', 'water', 'water', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'water', 'water', 'water'],
  ['water', 'water', 'rock', 'rock', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'water', 'water', 'water'],
  ['water', 'water', 'rock', 'rock', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'rock', 'rock', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'rock', 'rock', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'rock', 'rock', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
] as const;
const LOCATION_OPTIONS: readonly LocationOption[] = [
  {
    id: 'route-119-main',
    tabLabel: 'Route 119',
    displayName: 'Route 119, Hoenn',
    terrain: ROUTE_119_MAIN_TERRAIN,
  },
  {
    id: 'mt-coronet',
    tabLabel: 'Mt. Coronet',
    displayName: 'Mt. Coronet, Sinnoh',
    terrain: MT_CORONET_TERRAIN,
  },
] as const;
const LOCATION_OPTIONS_BY_ID = new Map(LOCATION_OPTIONS.map((option) => [option.id, option]));

function getStatusClasses(status: TileStatus) {
  return ({
    unchecked: 'bg-slate-500/70 text-white',
    checked: 'bg-rose-600/35 text-white',
    pending: 'bg-amber-400/35 text-slate-950',
    confirmed: 'bg-emerald-500/35 text-slate-950 ring-2 ring-emerald-200',
  }[status]);
}

function formatCopy(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
}

function getStatusLabel(status: TileStatus, labels: Record<TileStatus, string>) {
  return ({
    unchecked: labels.unchecked,
    checked: labels.checked,
    pending: labels.pending,
    confirmed: labels.confirmed,
  }[status]);
}

function getTerrainClasses(terrain: string) {
  return ({
    grass: 'bg-[linear-gradient(180deg,_#c4e2ab_0%,_#8fbd72_100%)]',
    bank: 'bg-[linear-gradient(180deg,_#f0dfaa_0%,_#cfb479_100%)]',
    water: 'bg-[linear-gradient(180deg,_#5f7fa6_0%,_#435b79_100%)]',
    rock: 'bg-[linear-gradient(180deg,_#62666f_0%,_#3b3f48_100%)]',
  }[terrain] || 'bg-transparent');
}

function getVoteActionMessage(
  actionType: string,
  nextStatus: TileStatus | null,
  labels: Record<TileStatus, string>,
  actionsCopy: {
    clearedVote: string;
    checkedVote: string;
    pendingVote: string;
    confirmedVote: string;
  }
) {
  if (actionType === 'cleared_vote') {
    return actionsCopy.clearedVote;
  }

  return (
    {
      checked: actionsCopy.checkedVote,
      pending: actionsCopy.pendingVote,
      confirmed: actionsCopy.confirmedVote,
      unchecked: getStatusLabel('unchecked', labels),
    }[nextStatus || 'unchecked']
  );
}

function getVoteLayerOpacity(voteCount: number) {
  return Math.min(voteCount * 0.25, 0.95);
}

function getVoteLayerColor(status: Exclude<TileStatus, 'unchecked'>) {
  return ({
    checked: '#e11d48',
    pending: '#fbbf24',
    confirmed: '#10b981',
  }[status]);
}

function getHeatmapOpacity(confirmations: number, maxConfirmations: number) {
  if (confirmations <= 0) {
    return 0;
  }

  if (maxConfirmations <= 1) {
    return 1;
  }

  const ratio = (confirmations - 1) / (maxConfirmations - 1);
  return 0.3 + (ratio * 0.7);
}

function getVoteSummary(
  tile: FeebasTile,
  summaryLabels: { checked: string; pending: string; confirmed: string }
) {
  return [
    `${tile.voteCounts.checked} ${summaryLabels.checked}`,
    `${tile.voteCounts.pending} ${summaryLabels.pending}`,
    `${tile.voteCounts.confirmed} ${summaryLabels.confirmed}`,
  ].join(', ');
}

function formatCountdown(targetIso: string | null) {
  if (!targetIso) {
    return '--:--';
  }

  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) {
    return '00:00';
  }

  const totalSeconds = Math.floor(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function createClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatActorName(actorName: string | null, anonymousName: string) {
  return actorName?.trim() || anonymousName;
}

function formatTimestamp(isoTimestamp: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoTimestamp));
}

function formatScore(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatUptime(minutes: number, locale: string) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '0m';
  }

  if (minutes < 60) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(minutes)}m`;
  }

  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(minutes / 60)}h`;
}

function formatPercent(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDuration(seconds: number | null, fallback: string) {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return fallback;
  }

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function formatNullableCount(value: number | null, fallback: string) {
  return Number.isFinite(value || NaN) && value ? String(value) : fallback;
}

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
  if (sortKey === 'rank') {
    return compareLeaderboardDefault(left, right);
  }

  if (sortKey === 'ign') {
    return left.ign.localeCompare(right.ign);
  }

  return (
    compareLeaderboardNumbers(left[sortKey], right[sortKey])
    || compareLeaderboardDefault(left, right)
  );
}

function sortLeaderboardEntries(entries: FeebasLeaderboardEntry[], sort: LeaderboardSortState) {
  const directionMultiplier = sort.direction === 'desc' ? -1 : 1;

  return [...entries].sort((left, right) => (
    compareLeaderboardEntries(left, right, sort.key) * directionMultiplier
  ));
}

function getSortIconVariant(columnKey: LeaderboardSortKey, sort: LeaderboardSortState): SortIconVariant {
  if (sort.key !== columnKey) {
    return 'sort';
  }

  return sort.direction === 'desc' ? 'sort-down' : 'sort-up';
}

function SortIcon({ variant }: { variant: SortIconVariant }) {
  if (variant === 'sort-up') {
    return (
      <svg
        aria-hidden="true"
        className="h-3 w-3 shrink-0 fill-current"
        data-sort-icon={variant}
        viewBox="0 0 16 16"
      >
        <path d="M4 10h8L8 4l-4 6z" />
      </svg>
    );
  }

  if (variant === 'sort-down') {
    return (
      <svg
        aria-hidden="true"
        className="h-3 w-3 shrink-0 fill-current"
        data-sort-icon={variant}
        viewBox="0 0 16 16"
      >
        <path d="M4 6h8l-4 6-4-6z" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="h-3 w-3 shrink-0 fill-current"
      data-sort-icon={variant}
      viewBox="0 0 16 16"
    >
      <path d="M4 6h8L8 2 4 6z" />
      <path d="M4 10h8l-4 4-4-4z" />
    </svg>
  );
}

function LeaderboardHeaderTooltip({
  children,
  tooltip,
  align = 'center',
}: {
  children: React.ReactNode;
  tooltip: string;
  align?: 'left' | 'center' | 'right';
}) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') {
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const width = Math.min(
      TOOLTIP_MAX_WIDTH_PX,
      Math.max(0, viewportWidth - (TOOLTIP_VIEWPORT_MARGIN_PX * 2))
    );
    const triggerCenter = triggerRect.left + (triggerRect.width / 2);
    const preferredLeft = align === 'left'
      ? triggerRect.left
      : align === 'right'
        ? triggerRect.right - width
        : triggerCenter - (width / 2);
    const maxLeft = Math.max(TOOLTIP_VIEWPORT_MARGIN_PX, viewportWidth - width - TOOLTIP_VIEWPORT_MARGIN_PX);
    const left = Math.min(Math.max(preferredLeft, TOOLTIP_VIEWPORT_MARGIN_PX), maxLeft);

    setPosition({
      top: triggerRect.bottom + TOOLTIP_VIEWPORT_MARGIN_PX,
      left,
      width,
      arrowLeft: Math.min(
        Math.max(triggerCenter - left, TOOLTIP_ARROW_MARGIN_PX),
        Math.max(TOOLTIP_ARROW_MARGIN_PX, width - TOOLTIP_ARROW_MARGIN_PX)
      ),
    });
  }, [align]);

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isVisible, updatePosition]);

  const showTooltip = () => {
    updatePosition();
    setIsVisible(true);
  };

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex"
      onBlur={() => setIsVisible(false)}
      onFocus={showTooltip}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <span
        aria-hidden={!isVisible}
        className={`pointer-events-none fixed z-[70] transition-opacity ${isVisible && position ? 'visible opacity-100' : 'invisible opacity-0'}`}
        style={{
          left: position ? `${position.left}px` : undefined,
          top: position ? `${position.top}px` : undefined,
          width: position ? `${position.width}px` : undefined,
        }}
      >
        <span className="relative block rounded bg-gray-800 px-3 py-2 text-left text-xs font-medium normal-case leading-snug text-white shadow-lg dark:bg-gray-100 dark:text-black">
          <span
            className="absolute -top-1 h-2 w-2 -translate-x-1/2 rotate-45 bg-gray-800 dark:bg-gray-100"
            style={{ left: position ? `${position.arrowLeft}px` : undefined }}
          />
          {tooltip}
        </span>
      </span>
    </span>
  );
}

function getNextLeaderboardSort(
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

function getLeaderboardNotables(entries: FeebasLeaderboardEntry[]) {
  const entriesWithFinds = entries.filter((entry) => entry.verifiedDiscoveries > 0);
  const fastestFinder = [...entriesWithFinds]
    .filter((entry) => Number.isFinite(entry.fastestFindSeconds || NaN) && (entry.fastestFindSeconds || 0) > 0)
    .sort((left, right) => (left.fastestFindSeconds || 0) - (right.fastestFindSeconds || 0))[0] || null;
  const earlyScout = [...entries]
    .filter((entry) => entry.earlyScoutSeconds !== null && Number.isFinite(entry.earlyScoutSeconds))
    .sort((left, right) => (left.earlyScoutSeconds || 0) - (right.earlyScoutSeconds || 0))[0] || null;
  const mostPersistent = [...entriesWithFinds]
    .filter((entry) => Number.isFinite(entry.mostPersistentChecks || NaN) && (entry.mostPersistentChecks || 0) > 0)
    .sort((left, right) => (right.mostPersistentChecks || 0) - (left.mostPersistentChecks || 0))[0] || null;

  return {
    fastestFinder,
    earlyScout,
    mostPersistent,
  };
}

function getTileLabel(row: number, col: number, totalRows: number) {
  return `${String.fromCharCode(65 + col)}${totalRows - row}`;
}

function resolveLocationId(location?: string) {
  return location && LOCATION_OPTIONS_BY_ID.has(location) ? location : DEFAULT_LOCATION;
}

function getStoredLocationId() {
  try {
    const storedLocation = localStorage.getItem(ACTIVE_LOCATION_STORAGE_KEY) || undefined;
    return storedLocation && LOCATION_OPTIONS_BY_ID.has(storedLocation) ? storedLocation : null;
  } catch {
    return null;
  }
}

function getInitialLocationId(location?: string) {
  if (location) {
    return resolveLocationId(location);
  }

  return getStoredLocationId() || DEFAULT_LOCATION;
}

function getBoardMinWidth(cols: number) {
  return `${Math.max(cols * BOARD_MIN_TILE_SIZE_PX, BOARD_MIN_WIDTH_PX)}px`;
}

function LoadingPlaceholder({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-full bg-slate-200/90 dark:bg-slate-700/80 ${className}`}
    />
  );
}

function isAuthUser(value: AuthUser | null | undefined): value is AuthUser {
  return Boolean(value && typeof value.id === 'string' && typeof value.ign === 'string');
}

const FeebasTileChecker = ({ apiBaseUrl, location, locale }: Props) => {
  const normalizedApiBaseUrl = useMemo(() => apiBaseUrl.replace(/\/+$/, ''), [apiBaseUrl]);
  const activeLocale = getClientLocale(locale);
  const translations = getTranslations(activeLocale);
  const messages = translations.tools.feebasChecker;
  const authMessages = translations.auth;
  const localizedLocationOptions: readonly LocationOption[] = [
    {
      id: 'route-119-main',
      tabLabel: messages.locations.route119.tabLabel,
      displayName: messages.locations.route119.displayName,
      terrain: ROUTE_119_MAIN_TERRAIN,
    },
    {
      id: 'mt-coronet',
      tabLabel: messages.locations.mtCoronet.tabLabel,
      displayName: messages.locations.mtCoronet.displayName,
      terrain: MT_CORONET_TERRAIN,
    },
  ] as const;
  const localizedLocationOptionsById = new Map(localizedLocationOptions.map((option) => [option.id, option]));
  const [activeLocation, setActiveLocation] = useState(() => getInitialLocationId(location));
  const [board, setBoard] = useState<FeebasBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<BoardDisplayMode>('voting');
  const [leaderboardSort, setLeaderboardSort] = useState<LeaderboardSortState>(DEFAULT_LEADERBOARD_SORT);
  const [activityPage, setActivityPage] = useState(1);
  const [countdown, setCountdown] = useState('--:--');
  const lastFetchedCycleEndRef = useRef<string | null>(null);
  const resetRefreshInFlightRef = useRef(false);
  const activeLocationOption = localizedLocationOptionsById.get(activeLocation) || localizedLocationOptionsById.get(DEFAULT_LOCATION)!;
  const activeTerrain = activeLocationOption.terrain;
  const actorFingerprint = authUser ? `account-${authUser.id}` : clientId;
  const voteActorName = authUser?.ign.trim();
  const authHref = getLocaleParamPath('/auth', activeLocale);
  const querySuffix = actorFingerprint ? `?actorFingerprint=${encodeURIComponent(actorFingerprint)}` : '';

  const applyBoardUpdate = (nextBoard: FeebasBoard) => {
    setBoard((currentBoard) => ({
      ...nextBoard,
      leaderboard: nextBoard.leaderboard
        || (currentBoard?.location === nextBoard.location ? currentBoard.leaderboard : undefined),
    }));
  };

  const fetchBoard = async () => {
    if (!actorFingerprint) {
      return;
    }

    const response = await fetch(`${normalizedApiBaseUrl}/feebas/${activeLocation}${querySuffix}`);
    const payload: BoardResponse = await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(payload.message || messages.errors.loadBoard);
    }

    applyBoardUpdate(payload.data);
    setCountdown(formatCountdown(payload.data.cycleEnd));
    lastFetchedCycleEndRef.current = payload.data.cycleEnd;
  };

  useEffect(() => {
    try {
      const storedClientId = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
      const resolvedClientId = storedClientId || createClientId();
      localStorage.setItem(CLIENT_ID_STORAGE_KEY, resolvedClientId);
      setClientId(resolvedClientId);

    } catch {
      setClientId(createClientId());
    }
  }, []);

  useEffect(() => {
    const handleAuthUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<AuthUser | null>;
      const nextUser = customEvent.detail;

      setAuthUser(isAuthUser(nextUser) ? nextUser : null);
      setIsAuthLoading(false);
    };

    window.addEventListener('team-soju-auth-updated', handleAuthUpdated);

    return () => {
      window.removeEventListener('team-soju-auth-updated', handleAuthUpdated);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadAuthUser() {
      setIsAuthLoading(true);

      try {
        const response = await fetch(`${normalizedApiBaseUrl}/auth/me`, {
          credentials: 'include',
        });
        const body = await response.json() as AuthResponse;
        const nextUser = body.data;

        if (mounted && response.ok && body.success && isAuthUser(nextUser)) {
          setAuthUser(nextUser);
        } else if (mounted) {
          setAuthUser(null);
        }
      } catch {
        if (mounted) {
          setAuthUser(null);
        }
      } finally {
        if (mounted) {
          setIsAuthLoading(false);
        }
      }
    }

    loadAuthUser();

    return () => {
      mounted = false;
    };
  }, [normalizedApiBaseUrl]);

  useEffect(() => {
    if (location) {
      setActiveLocation(resolveLocationId(location));
    }
  }, [location]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_LOCATION_STORAGE_KEY, activeLocation);
    } catch {
      // Ignore storage write failures.
    }
  }, [activeLocation]);

  useEffect(() => {
    if (!actorFingerprint || isAuthLoading) {
      return;
    }

    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setBoard(null);
        setSelectedTileId(null);
        setActivityPage(1);
        await fetchBoard();
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : messages.errors.loadBoard);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [activeLocation, normalizedApiBaseUrl, actorFingerprint, isAuthLoading]);

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      return undefined;
    }

    if (!actorFingerprint || isAuthLoading) {
      return undefined;
    }

    const eventSource = new EventSource(`${normalizedApiBaseUrl}/feebas/${activeLocation}/stream?actorFingerprint=${encodeURIComponent(actorFingerprint)}`);

    eventSource.onmessage = (event) => {
      try {
        const payload: BoardResponse = JSON.parse(event.data);
        if (payload.success) {
          applyBoardUpdate(payload.data);
          setCountdown(formatCountdown(payload.data.cycleEnd));
          lastFetchedCycleEndRef.current = payload.data.cycleEnd;
          resetRefreshInFlightRef.current = false;
          setError(null);
        }
      } catch {
        // Ignore malformed event payloads and rely on the next valid update.
      }
    };

    eventSource.onerror = () => {
      setError((currentError) => currentError || messages.errors.liveUpdatesDisconnected);
    };

    return () => {
      eventSource.close();
    };
  }, [activeLocation, normalizedApiBaseUrl, actorFingerprint, isAuthLoading]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(formatCountdown(lastFetchedCycleEndRef.current));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (countdown !== '00:00' || resetRefreshInFlightRef.current) {
      return;
    }

    resetRefreshInFlightRef.current = true;
    fetchBoard().catch((nextError) => {
      resetRefreshInFlightRef.current = false;
      setError(nextError instanceof Error ? nextError.message : messages.errors.refreshBoard);
    });
  }, [countdown]);

  const tileMap = useMemo(() => {
    if (!board) {
      return new Map<string, FeebasTile>();
    }

    return new Map(board.tiles.map((tile) => [tile.tileId, tile]));
  }, [board]);

  const tileByPosition = useMemo(() => {
    if (!board) {
      return new Map<string, FeebasTile>();
    }

    return new Map(board.tiles.map((tile) => [`${tile.row}-${tile.col}`, tile]));
  }, [board]);

  const previousConfirmedTileCounts = useMemo(() => {
    if (!board) {
      return new Map<string, number>();
    }

    return new Map(
      (board.previousConfirmedTiles || []).map((tile) => [tile.tileId, tile.confirmations])
    );
  }, [board]);

  const maxPreviousConfirmations = useMemo(() => {
    const previousConfirmedTiles = board?.previousConfirmedTiles || [];

    if (!previousConfirmedTiles.length) {
      return 0;
    }

    return Math.max(...previousConfirmedTiles.map((tile) => tile.confirmations));
  }, [board]);

  const selectedTile = selectedTileId ? tileMap.get(selectedTileId) || null : null;
  const totalCheckedVotes = board?.tiles.reduce((sum, tile) => sum + tile.voteCounts.checked, 0) || 0;
  const totalPendingVotes = board?.tiles.reduce((sum, tile) => sum + tile.voteCounts.pending, 0) || 0;
  const totalConfirmedVotes = board?.tiles.reduce((sum, tile) => sum + tile.voteCounts.confirmed, 0) || 0;
  const activityEntries = board?.activity || [];
  const activityPageCount = Math.max(1, Math.ceil(activityEntries.length / ACTIVITY_PAGE_SIZE));
  const activityCurrentPage = Math.min(activityPage, activityPageCount);
  const activityStartIndex = (activityCurrentPage - 1) * ACTIVITY_PAGE_SIZE;
  const paginatedActivityEntries = activityEntries.slice(activityStartIndex, activityStartIndex + ACTIVITY_PAGE_SIZE);
  const leaderboardEntries = board?.leaderboard?.entries || [];
  const leaderboardColumns: LeaderboardColumn[] = [
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
  const sortedLeaderboardEntries = useMemo(
    () => sortLeaderboardEntries(leaderboardEntries, leaderboardSort),
    [leaderboardEntries, leaderboardSort]
  );
  const leaderboardNotables = useMemo(() => getLeaderboardNotables(leaderboardEntries), [leaderboardEntries]);
  const selectedTileLabel = selectedTile ? getTileLabel(selectedTile.row, selectedTile.col, board?.layout.rows || activeTerrain.length) : null;
  const selectedTileCurrentVote = selectedTile?.currentUserVote || 'unchecked';
  const selectedTileHasPending = Boolean(selectedTile && selectedTile.voteCounts.pending > 0);
  const selectedTileIsPendingOwner = selectedTileCurrentVote === 'pending';
  const selectedTileHasNoVote = selectedTileCurrentVote === 'unchecked';
  const layoutRows = board?.layout.rows || activeTerrain.length;
  const layoutCols = board?.layout.cols || activeTerrain[0]?.length || 1;
  const boardMinWidth = getBoardMinWidth(layoutCols);
  const isHeatmapMode = displayMode === 'heatmap';
  const canConfirmSelectedTile = Boolean(
    selectedTile &&
    selectedTileHasPending &&
    !selectedTileIsPendingOwner &&
    selectedTileCurrentVote !== 'confirmed'
  );

  useEffect(() => {
    if (activityPage > activityPageCount) {
      setActivityPage(activityPageCount);
    }
  }, [activityPage, activityPageCount]);

  const updateTile = async (tileId: string, status: TileStatus) => {
    if (!actorFingerprint || isHeatmapMode) {
      return;
    }

    setPendingAction(tileId);
    setError(null);

    try {
      const response = await fetch(`${normalizedApiBaseUrl}/feebas/${activeLocation}/tiles/${tileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          actorFingerprint,
          actorName: voteActorName || undefined,
        }),
      });
      const payload: BoardResponse = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || messages.errors.updateTile);
      }

      applyBoardUpdate(payload.data);
      setSelectedTileId(tileId);
      lastFetchedCycleEndRef.current = payload.data.cycleEnd;
      setCountdown(formatCountdown(payload.data.cycleEnd));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : messages.errors.updateTile);
    } finally {
      setPendingAction(null);
    }
  };

  const handleTilePress = (tile: FeebasTile) => {
    if (isHeatmapMode) {
      return;
    }

    setSelectedTileId(tile.tileId);

    if (pendingAction || tile.currentUserVote !== 'unchecked' || tile.voteCounts.pending > 0 || tile.voteCounts.confirmed > 0) {
      return;
    }

    updateTile(tile.tileId, 'checked');
  };

  if (error && !board) {
    return (
      <div className="card p-8 text-center">
        <span className="text-rose-600 dark:text-rose-300">{error || messages.general.loadingBoard}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loading && !board ? <span className="sr-only">{messages.general.loadingBoard}</span> : null}
      <section className="card p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={messages.locationsTabLabel}>
            {localizedLocationOptions.map((option) => {
              const isActive = option.id === activeLocation;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveLocation(option.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {option.tabLabel}
                </button>
              );
            })}
          </div>

          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            {loading && !board ? (
              <LoadingPlaceholder className="h-10 w-56 max-w-full rounded-xl" />
            ) : (
              activeLocationOption.displayName
            )}
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-3 rounded-2xl bg-slate-100 p-4 dark:bg-slate-900/70">
              <span className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                {messages.general.nextReset}
              </span>
              {loading && !board ? (
                <>
                  <LoadingPlaceholder className="h-10 w-28 rounded-xl" />
                  <LoadingPlaceholder className="h-4 w-48 max-w-full rounded-md" />
                </>
              ) : (
                <>
                  <span className="font-display text-3xl text-slate-900 dark:text-white">{countdown}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {formatCopy(messages.general.resetsEvery, {
                      minutes: board?.resetIntervalMinutes || 45,
                    })}
                  </span>
                </>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
              {loading && !board ? (
                <div className="space-y-2">
                  <LoadingPlaceholder className="h-4 w-full rounded-md" />
                  <LoadingPlaceholder className="h-4 w-11/12 rounded-md" />
                  <LoadingPlaceholder className="h-4 w-8/12 rounded-md" />
                </div>
              ) : (
                messages.general.rules
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {isAuthLoading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
              {authMessages.loading}
            </div>
          ) : authUser ? (
          <p className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-medium text-primary-800 dark:border-primary-800/60 dark:bg-primary-950/40 dark:text-primary-200">
              {formatCopy(messages.general.signedInAs, { ign: authUser.ign })}
            </p>
          ) : (
            <a
              href={authHref}
              className={LEADERBOARD_SIGN_IN_CTA_CLASSES}
            >
              {messages.general.signInToTrackLeaderboardStats}
            </a>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-br from-sky-100 via-cyan-100 to-teal-100 p-4 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3 text-sm">
                {displayMode === 'voting' ? (
                  <>
                    <span className="rounded-full bg-slate-500 px-3 py-1 text-white">{messages.status.unchecked}</span>
                    <span className="rounded-full bg-rose-600 px-3 py-1 text-white">{messages.status.checked}</span>
                    <span className="rounded-full bg-amber-400 px-3 py-1 text-slate-950">{messages.status.pending}</span>
                    <span className="rounded-full bg-emerald-500 px-3 py-1 text-slate-950">{messages.status.confirmed}</span>
                  </>
                ) : (
                  <>
                    <span className="rounded-full bg-amber-500/25 px-3 py-1 text-slate-900 ring-1 ring-amber-500/50 dark:text-white dark:ring-amber-300/50">
                      {messages.heatmap.lowLegend}
                    </span>
                    <span className="rounded-full bg-amber-500 px-3 py-1 text-slate-950">
                      {messages.heatmap.highLegend}
                    </span>
                  </>
                )}
              </div>
              <div
                className="inline-flex rounded-full border border-slate-300 bg-white/80 p-1 text-sm shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/80"
                role="group"
                aria-label={messages.heatmap.toggleLabel}
              >
                <button
                  type="button"
                  onClick={() => setDisplayMode('voting')}
                  aria-pressed={displayMode === 'voting'}
                  className={`rounded-full px-3 py-1.5 font-semibold transition ${
                    displayMode === 'voting'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {messages.heatmap.votingMode}
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode('heatmap')}
                  aria-pressed={displayMode === 'heatmap'}
                  className={`rounded-full px-3 py-1.5 font-semibold transition ${
                    displayMode === 'heatmap'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {messages.heatmap.heatmapMode}
                </button>
              </div>
            </div>
            <p className="mt-3 text-xs font-medium text-slate-600 dark:text-slate-300 sm:hidden">
              {messages.general.scrollHint}
            </p>
            {displayMode === 'heatmap' ? (
              <p className="mt-3 text-xs font-medium text-slate-600 dark:text-slate-300">
                {messages.heatmap.description}
              </p>
            ) : null}
          </div>

          <div className="overflow-x-auto overscroll-x-contain bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.35),_transparent_30%),linear-gradient(180deg,_#d6f2f4_0%,_#8fd4e8_45%,_#4d8bc6_100%)] p-4">
            <div
              className="grid gap-1 rounded-2xl border border-sky-100/50 bg-sky-950/10 p-2 shadow-[0_18px_45px_rgba(20,55,107,0.24)] backdrop-blur-sm"
              style={{
                minWidth: boardMinWidth,
                gridTemplateColumns: `repeat(${layoutCols}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: layoutRows * layoutCols }, (_, index) => {
                const cols = layoutCols;
                const row = Math.floor(index / cols);
                const col = index % cols;
                const tile = tileByPosition.get(`${row}-${col}`) || null;
                const terrain = activeTerrain[row]?.[col] || 'water';
                const terrainClasses = getTerrainClasses(terrain);

                if (loading && !board) {
                  return (
                    <div
                      key={`placeholder-${row}-${col}`}
                      className={`relative aspect-square rounded-[0.35rem] border border-white/10 ${terrainClasses}`}
                    >
                      <div className="absolute inset-[8%] rounded-[0.3rem] bg-[linear-gradient(180deg,_rgba(255,255,255,0.18),_rgba(255,255,255,0.03))]" />
                      <div className="absolute inset-[8%] animate-pulse rounded-[0.3rem] bg-slate-100/20" />
                    </div>
                  );
                }

                if (!tile) {
                  return (
                    <div
                      key={`void-${row}-${col}`}
                      className={`aspect-square rounded-[0.35rem] border border-black/5 ${terrainClasses}`}
                    />
                  );
                }

                const isSelected = selectedTileId === tile.tileId;
                const tileLabel = getTileLabel(tile.row, tile.col, board?.layout.rows || activeTerrain.length);
                const previousConfirmations = previousConfirmedTileCounts.get(tile.tileId) || 0;
                const heatmapOpacity = getHeatmapOpacity(previousConfirmations, maxPreviousConfirmations);
                return (
                  <div
                    key={tile.tileId}
                    className={`relative aspect-square rounded-[0.35rem] border border-white/10 ${terrainClasses}`}
                  >
                    <div className="absolute inset-[8%] rounded-[0.3rem] bg-[linear-gradient(180deg,_rgba(255,255,255,0.18),_rgba(255,255,255,0.03))]" />
                    {!isHeatmapMode && tile.voteCounts.checked > 0 ? (
                      <div
                        className="absolute inset-[8%] rounded-[0.3rem]"
                        style={{
                          backgroundColor: getVoteLayerColor('checked'),
                          opacity: getVoteLayerOpacity(tile.voteCounts.checked),
                        }}
                      />
                    ) : null}
                    {!isHeatmapMode && tile.voteCounts.pending > 0 ? (
                      <div
                        className="absolute inset-[8%] rounded-[0.3rem]"
                        style={{
                          backgroundColor: getVoteLayerColor('pending'),
                          opacity: getVoteLayerOpacity(tile.voteCounts.pending),
                        }}
                      />
                    ) : null}
                    {!isHeatmapMode && tile.voteCounts.confirmed > 0 ? (
                      <div
                        className="absolute inset-[8%] rounded-[0.3rem]"
                        style={{
                          backgroundColor: getVoteLayerColor('confirmed'),
                          opacity: getVoteLayerOpacity(tile.voteCounts.confirmed),
                        }}
                      />
                    ) : null}
                    {isHeatmapMode && heatmapOpacity > 0 ? (
                      <div
                        className="absolute inset-[8%] rounded-[0.3rem]"
                        style={{
                          backgroundColor: '#f59e0b',
                          opacity: heatmapOpacity,
                        }}
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleTilePress(tile)}
                      className={`relative z-10 flex h-full w-full flex-col items-center justify-center rounded-[0.35rem] border border-white/20 px-1 text-[0.68rem] font-semibold uppercase tracking-wide transition ${
                        isHeatmapMode ? 'bg-slate-950/20 text-white' : getStatusClasses(tile.status)
                      } ${isSelected ? 'scale-[0.97] ring-2 ring-white/80' : ''} ${
                        pendingAction === tile.tileId ? 'cursor-wait' : isHeatmapMode ? 'cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      aria-pressed={isSelected}
                      aria-label={`${tileLabel} ${getVoteSummary(tile, messages.voteSummary)}`}
                      disabled={pendingAction === tile.tileId || isHeatmapMode}
                    >
                      <span>{tileLabel}</span>
                      {!isHeatmapMode && tile.totalVotes > 0 ? (
                        <span className="mt-1 rounded bg-black/25 px-1.5 py-0.5 text-[0.54rem] tracking-normal text-white">
                          {tile.totalVotes}
                        </span>
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{messages.boardStatus.heading}</h3>
            <div className="mt-4 grid gap-3 text-sm text-slate-700 dark:text-slate-200">
              <div className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-900">
                <span>{messages.boardStatus.checkedTiles}</span>
                {loading && !board ? <LoadingPlaceholder className="h-5 w-10 rounded-md" /> : <span className="font-semibold">{totalCheckedVotes}</span>}
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-900">
                <span>{messages.boardStatus.pendingTiles}</span>
                {loading && !board ? <LoadingPlaceholder className="h-5 w-10 rounded-md" /> : <span className="font-semibold">{totalPendingVotes}</span>}
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-900">
                <span>{messages.boardStatus.confirmedTiles}</span>
                {loading && !board ? <LoadingPlaceholder className="h-5 w-10 rounded-md" /> : <span className="font-semibold">{totalConfirmedVotes}</span>}
              </div>
              <div className="rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-900">
                {loading && !board ? (
                  <div className="space-y-2">
                    <LoadingPlaceholder className="h-4 w-full rounded-md" />
                    <LoadingPlaceholder className="h-4 w-8/12 rounded-md" />
                  </div>
                ) : (
                  <p>{messages.general.mixedVotesHint}</p>
                )}
              </div>
              {error ? (
                <p className="rounded-xl bg-rose-50 px-4 py-3 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
                  {error}
                </p>
              ) : null}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{messages.selectedTile.heading}</h3>
            {loading && !board ? (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <LoadingPlaceholder className="h-4 w-12 rounded-md" />
                  <LoadingPlaceholder className="h-8 w-20 rounded-lg" />
                  <LoadingPlaceholder className="h-4 w-40 rounded-md" />
                </div>
                <div className="space-y-2">
                  <LoadingPlaceholder className="h-4 w-32 rounded-md" />
                  <LoadingPlaceholder className="h-4 w-36 rounded-md" />
                  <LoadingPlaceholder className="h-4 w-40 rounded-md" />
                  <LoadingPlaceholder className="h-4 w-28 rounded-md" />
                </div>
                <div className="grid gap-3">
                  <LoadingPlaceholder className="h-10 w-full rounded-xl" />
                  <LoadingPlaceholder className="h-10 w-full rounded-xl" />
                  <LoadingPlaceholder className="h-10 w-full rounded-xl" />
                  <LoadingPlaceholder className="h-10 w-full rounded-xl" />
                </div>
              </div>
            ) : selectedTile ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">{messages.selectedTile.tileLabel}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{selectedTileLabel}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {formatCopy(messages.selectedTile.leadingStatus, {
                      status: getStatusLabel(selectedTile.status, messages.status),
                    })}
                  </p>
                </div>

                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <p>{formatCopy(messages.selectedTile.checkedVotes, { count: selectedTile.voteCounts.checked })}</p>
                  <p>{formatCopy(messages.selectedTile.pendingVotes, { count: selectedTile.voteCounts.pending })}</p>
                  <p>{formatCopy(messages.selectedTile.confirmedVotes, { count: selectedTile.voteCounts.confirmed })}</p>
                  <p>{formatCopy(messages.selectedTile.yourVote, {
                    status: getStatusLabel(selectedTile.currentUserVote, messages.status),
                  })}</p>
                </div>

                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => updateTile(selectedTile.tileId, 'checked')}
                    className="btn bg-rose-600 text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isHeatmapMode || pendingAction === selectedTile.tileId || selectedTile.currentUserVote === 'checked'}
                  >
                    {messages.selectedTile.noFeebas}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTile(selectedTile.tileId, 'pending')}
                    className="btn bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isHeatmapMode || pendingAction === selectedTile.tileId || selectedTileIsPendingOwner || (selectedTileHasPending && !selectedTileIsPendingOwner)}
                  >
                    {messages.selectedTile.feebasFound}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTile(selectedTile.tileId, 'confirmed')}
                    className="btn bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isHeatmapMode || pendingAction === selectedTile.tileId || !canConfirmSelectedTile}
                  >
                    {messages.selectedTile.feebasConfirmed}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTile(selectedTile.tileId, 'unchecked')}
                    className="btn bg-slate-200 text-slate-900 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-700"
                    disabled={isHeatmapMode || pendingAction === selectedTile.tileId || selectedTileHasNoVote}
                  >
                    {messages.selectedTile.clearVote}
                  </button>
                </div>

                {!selectedTileHasPending ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {messages.selectedTile.needsPendingBeforeConfirm}
                  </p>
                ) : null}
                {selectedTileIsPendingOwner ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {messages.selectedTile.pendingOwnerHint}
                  </p>
                ) : null}
                {selectedTileHasPending && selectedTileHasNoVote ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {messages.selectedTile.otherPendingHint}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                {messages.selectedTile.emptyState}
              </p>
            )}
          </div>

          <div className="card p-5">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{messages.activity.heading}</h3>
            {loading && !board ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={`activity-placeholder-${index}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70"
                  >
                    <div className="space-y-2">
                      <LoadingPlaceholder className="h-4 w-full rounded-md" />
                      <LoadingPlaceholder className="h-3 w-16 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activityEntries.length ? (
              <>
                <div className="mt-4 space-y-3">
                  {paginatedActivityEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/70"
                    >
                      <p className="text-slate-800 dark:text-slate-100">
                        <span className="font-semibold">{formatActorName(entry.actorName, messages.general.anonymousName)}</span>{' '}
                        {getVoteActionMessage(entry.actionType, entry.nextStatus, messages.status, messages.actions)}{' '}
                        <span className="font-semibold">{entry.tileLabel}</span>.
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {formatTimestamp(entry.createdAt, activeLocale)}
                      </p>
                    </div>
                  ))}
                </div>
                {activityPageCount > 1 ? (
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setActivityPage((currentPage) => Math.max(1, currentPage - 1))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
                      disabled={activityCurrentPage === 1}
                    >
                      {messages.activity.previousPage}
                    </button>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {formatCopy(messages.activity.pageStatus, {
                        current: activityCurrentPage,
                        total: activityPageCount,
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActivityPage((currentPage) => Math.min(activityPageCount, currentPage + 1))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
                      disabled={activityCurrentPage === activityPageCount}
                    >
                      {messages.activity.nextPage}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                {messages.activity.emptyState}
              </p>
            )}
          </div>
        </aside>
      </section>

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
                            onClick={() => setLeaderboardSort((currentSort) => getNextLeaderboardSort(column, currentSort))}
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
                  {sortedLeaderboardEntries.map((entry, index) => (
                    <tr key={entry.userId} className="text-slate-700 dark:text-slate-200">
                      <td className="px-3 py-3 font-semibold text-slate-900 dark:text-white">#{index + 1}</td>
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
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5">
              <h4 className="text-sm font-semibold uppercase text-slate-500 dark:text-slate-400">
                {messages.leaderboard.notables.heading}
              </h4>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                    {messages.leaderboard.notables.fastestFinder}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {leaderboardNotables.fastestFinder
                      ? formatCopy(messages.leaderboard.notables.fastestValue, {
                        ign: leaderboardNotables.fastestFinder.ign,
                        value: formatDuration(leaderboardNotables.fastestFinder.fastestFindSeconds, messages.leaderboard.notables.noData),
                      })
                      : messages.leaderboard.notables.noData}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                    {messages.leaderboard.notables.earlyScout}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {leaderboardNotables.earlyScout
                      ? formatCopy(messages.leaderboard.notables.fastestValue, {
                        ign: leaderboardNotables.earlyScout.ign,
                        value: formatDuration(leaderboardNotables.earlyScout.earlyScoutSeconds, messages.leaderboard.notables.noData),
                      })
                      : messages.leaderboard.notables.noData}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                    {messages.leaderboard.notables.mostPersistent}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {leaderboardNotables.mostPersistent
                      ? formatCopy(messages.leaderboard.notables.checksValue, {
                        ign: leaderboardNotables.mostPersistent.ign,
                        value: formatNullableCount(leaderboardNotables.mostPersistent.mostPersistentChecks, messages.leaderboard.notables.noData),
                      })
                      : messages.leaderboard.notables.noData}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
            {messages.leaderboard.emptyState}
          </p>
        )}
      </section>
    </div>
  );
};

export default FeebasTileChecker;
