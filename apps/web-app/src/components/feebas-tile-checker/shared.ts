import type { getTranslations, Locale } from '../../i18n';
import type { FeebasBoardDisplayMode } from './FeebasBoardLegend';
import { DEFAULT_LOCATION, LOCATION_OPTIONS_BY_ID } from './locations';

type Translations = ReturnType<typeof getTranslations>;

export type TileStatus = 'unchecked' | 'checked' | 'pending' | 'confirmed';
export type BoardDisplayMode = FeebasBoardDisplayMode;
export type FeebasCheckerMessages = Translations['tools']['feebasChecker'];
export type AuthMessages = Translations['auth'];

export type FeebasTile = {
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

export type FeebasActivityEntry = {
  id: number;
  tileId: string;
  tileLabel: string;
  actionType: string;
  previousStatus: string | null;
  nextStatus: TileStatus | null;
  actorName: string | null;
  createdAt: string;
};

export type FeebasLeaderboardEntry = {
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

export type LeaderboardSortKey =
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
export type LeaderboardSortDirection = 'asc' | 'desc';
export type LeaderboardSortState = {
  key: LeaderboardSortKey;
  direction: LeaderboardSortDirection;
};
export type LeaderboardColumn = {
  key: LeaderboardSortKey;
  label: string;
  tooltip: string;
  defaultDirection: LeaderboardSortDirection;
};

export type FeebasLeaderboard = {
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

export type FeebasBoard = {
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

export type BoardResponse = {
  success: boolean;
  data: FeebasBoard;
  message?: string;
};

export type AuthUser = {
  id: string;
  email: string;
  ign: string;
};

export type AuthResponse = {
  success: boolean;
  data?: AuthUser | null;
  message?: string;
};

export type FeebasTileCheckerProps = {
  apiBaseUrl: string;
  location?: string;
  locale?: Locale | string;
};

export type PendingNominationNotification = {
  title: string;
  message: string;
  isSelfNomination: boolean;
};

export const ACTIVITY_PAGE_SIZE = 5;
export const CLIENT_ID_STORAGE_KEY = 'feebas-tile-checker-client-id';
export const ACTIVE_LOCATION_STORAGE_KEY = 'feebas-tile-checker-active-location';
export const BOARD_MIN_TILE_SIZE_PX = 40;
export const BOARD_MIN_WIDTH_PX = 768;
export const LEADERBOARD_SIGN_IN_CTA_CLASSES =
  'inline-flex items-center justify-center rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600';
export const PENDING_NOMINATION_NOTIFICATION_TIMEOUT_MS = 6000;
export const RESET_REFRESH_RETRY_MS = 1000;
export const FEEBAS_LIVE_UPDATES_RECONNECT_MS = 5000;

export function formatCopy(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
}

export function getStatusClasses(status: TileStatus) {
  return ({
    unchecked: 'bg-slate-500/70 text-white',
    checked: 'bg-rose-600/35 text-white',
    pending: 'bg-amber-400/35 text-slate-950',
    confirmed: 'bg-emerald-500/35 text-slate-950 ring-2 ring-emerald-200',
  }[status]);
}

export function getStatusLabel(status: TileStatus, labels: Record<TileStatus, string>) {
  return ({
    unchecked: labels.unchecked,
    checked: labels.checked,
    pending: labels.pending,
    confirmed: labels.confirmed,
  }[status]);
}

export function getTerrainClasses(terrain: string) {
  return ({
    grass: 'bg-[linear-gradient(180deg,_#c4e2ab_0%,_#8fbd72_100%)]',
    bank: 'bg-[linear-gradient(180deg,_#f0dfaa_0%,_#cfb479_100%)]',
    water: 'bg-[linear-gradient(180deg,_#5f7fa6_0%,_#435b79_100%)]',
    rock: 'bg-[linear-gradient(180deg,_#62666f_0%,_#3b3f48_100%)]',
  }[terrain] || 'bg-transparent');
}

export function getVoteActionMessage(
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

  return ({
    checked: actionsCopy.checkedVote,
    pending: actionsCopy.pendingVote,
    confirmed: actionsCopy.confirmedVote,
    unchecked: getStatusLabel('unchecked', labels),
  }[nextStatus || 'unchecked']);
}

export function getVoteLayerOpacity(voteCount: number) {
  return Math.min(voteCount * 0.25, 0.95);
}

export function getVoteLayerColor(status: Exclude<TileStatus, 'unchecked'>) {
  return ({
    checked: '#e11d48',
    pending: '#fbbf24',
    confirmed: '#10b981',
  }[status]);
}

export function getHeatmapOpacity(confirmations: number, maxConfirmations: number) {
  if (confirmations <= 0) return 0;
  if (maxConfirmations <= 1) return 1;

  const ratio = (confirmations - 1) / (maxConfirmations - 1);
  return 0.3 + (ratio * 0.7);
}

export function getVoteSummary(
  tile: FeebasTile,
  summaryLabels: { checked: string; pending: string; confirmed: string }
) {
  return [
    `${tile.voteCounts.checked} ${summaryLabels.checked}`,
    `${tile.voteCounts.pending} ${summaryLabels.pending}`,
    `${tile.voteCounts.confirmed} ${summaryLabels.confirmed}`,
  ].join(', ');
}

export function formatCountdown(targetIso: string | null) {
  if (!targetIso) return '--:--';

  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return '00:00';

  const totalSeconds = Math.ceil(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function createClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatActorName(actorName: string | null, anonymousName: string) {
  return actorName?.trim() || anonymousName;
}

export function formatTimestamp(isoTimestamp: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoTimestamp));
}

export function getTileLabel(row: number, col: number, totalRows: number) {
  return `${String.fromCharCode(65 + col)}${totalRows - row}`;
}

export function resolveLocationId(location?: string) {
  return location && LOCATION_OPTIONS_BY_ID.has(location) ? location : DEFAULT_LOCATION;
}

export function getStoredLocationId() {
  try {
    const storedLocation = localStorage.getItem(ACTIVE_LOCATION_STORAGE_KEY) || undefined;
    return storedLocation && LOCATION_OPTIONS_BY_ID.has(storedLocation) ? storedLocation : null;
  } catch {
    return null;
  }
}

export function getInitialLocationId(location?: string) {
  if (location) return resolveLocationId(location);
  return getStoredLocationId() || DEFAULT_LOCATION;
}

export function getBoardMinWidth(cols: number) {
  return `${Math.max(cols * BOARD_MIN_TILE_SIZE_PX, BOARD_MIN_WIDTH_PX)}px`;
}

export function getPendingActivityEntries(board: FeebasBoard) {
  return board.activity.filter((entry) => entry.actionType !== 'cleared_vote' && entry.nextStatus === 'pending');
}

export function isAuthUser(value: AuthUser | null | undefined): value is AuthUser {
  return Boolean(value && typeof value.id === 'string' && typeof value.ign === 'string');
}

export function buildFeebasLiveUpdatesUrl(apiBaseUrl: string, location: string, actorFingerprint: string) {
  const url = new URL(`${apiBaseUrl}/feebas/${location}/stream`, window.location.href);
  url.searchParams.set('actorFingerprint', actorFingerprint);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}
