import { ActivityPanel } from './ActivityPanel';
import { FeebasBoard } from './FeebasBoard';
import { FeebasStatusPanel } from './FeebasStatusPanel';
import { LeaderboardPanel } from './LeaderboardPanel';
import { LocationHeader } from './LocationHeader';
import { PendingNominationToast } from './PendingNominationToast';
import { SelectedTilePanel } from './SelectedTilePanel';
import type React from 'react';
import type { LocationOption } from './locations';
import type {
  AuthMessages,
  AuthUser,
  BoardDisplayMode,
  FeebasActivityEntry,
  FeebasBoard as FeebasBoardType,
  FeebasCheckerMessages,
  FeebasLeaderboardEntry,
  FeebasTile,
  LeaderboardSortState,
  PendingNominationNotification,
  TileStatus,
} from './shared';

type Props = {
  activeLocale: string;
  activeLocation: string;
  activeLocationOption: LocationOption;
  activeTerrain: readonly (readonly string[])[];
  activityCurrentPage: number;
  activityEntries: FeebasActivityEntry[];
  activityPageCount: number;
  authHref: string;
  authMessages: AuthMessages;
  authUser: AuthUser | null;
  board: FeebasBoardType | null;
  boardMinWidth: string;
  countdown: string;
  displayMode: BoardDisplayMode;
  displayModeHotkey: string;
  error: string | null;
  hotkeyCaptureError: string | null;
  isAuthLoading: boolean;
  isHeatmapMode: boolean;
  isHotkeyCaptureActive: boolean;
  layoutCols: number;
  layoutRows: number;
  leaderboardEntries: FeebasLeaderboardEntry[];
  leaderboardSort: LeaderboardSortState;
  loading: boolean;
  locationOptions: readonly LocationOption[];
  maxPreviousConfirmations: number;
  messages: FeebasCheckerMessages;
  paginatedActivityEntries: FeebasActivityEntry[];
  pendingAction: string | null;
  pendingNominationNotification: PendingNominationNotification | null;
  previousConfirmedTileCounts: Map<string, number>;
  selectedTile: FeebasTile | null;
  selectedTileId: string | null;
  selectedTileLabel: string | null;
  tileByPosition: Map<string, FeebasTile>;
  totalCheckedVotes: number;
  totalConfirmedVotes: number;
  totalPendingVotes: number;
  onActivityPageChange: React.Dispatch<React.SetStateAction<number>>;
  onDismissPendingNomination: () => void;
  onDisplayModeChange: React.Dispatch<React.SetStateAction<BoardDisplayMode>>;
  onLeaderboardSortChange: React.Dispatch<React.SetStateAction<LeaderboardSortState>>;
  onLocationChange: React.Dispatch<React.SetStateAction<string>>;
  onResetHotkey: () => void;
  onStartHotkeyCapture: () => void;
  onTilePress: (tile: FeebasTile) => void;
  onUpdateTile: (tileId: string, status: TileStatus) => void;
};

export function FeebasTileCheckerView({
  activeLocale,
  activeLocation,
  activeLocationOption,
  activeTerrain,
  activityCurrentPage,
  activityEntries,
  activityPageCount,
  authHref,
  authMessages,
  authUser,
  board,
  boardMinWidth,
  countdown,
  displayMode,
  displayModeHotkey,
  error,
  hotkeyCaptureError,
  isAuthLoading,
  isHeatmapMode,
  isHotkeyCaptureActive,
  layoutCols,
  layoutRows,
  leaderboardEntries,
  leaderboardSort,
  loading,
  locationOptions,
  maxPreviousConfirmations,
  messages,
  paginatedActivityEntries,
  pendingAction,
  pendingNominationNotification,
  previousConfirmedTileCounts,
  selectedTile,
  selectedTileId,
  selectedTileLabel,
  tileByPosition,
  totalCheckedVotes,
  totalConfirmedVotes,
  totalPendingVotes,
  onActivityPageChange,
  onDismissPendingNomination,
  onDisplayModeChange,
  onLeaderboardSortChange,
  onLocationChange,
  onResetHotkey,
  onStartHotkeyCapture,
  onTilePress,
  onUpdateTile,
}: Props) {
  if (error && !board) {
    return (
      <div className="card p-8 text-center">
        <span className="text-rose-600 dark:text-rose-300">{error || messages.general.loadingBoard}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pendingNominationNotification ? (
        <PendingNominationToast
          notification={pendingNominationNotification}
          messages={messages}
          onDismiss={onDismissPendingNomination}
        />
      ) : null}
      {loading && !board ? <span className="sr-only">{messages.general.loadingBoard}</span> : null}
      <LocationHeader
        activeLocation={activeLocation}
        activeLocationOption={activeLocationOption}
        authHref={authHref}
        authMessages={authMessages}
        authUser={authUser}
        board={board}
        countdown={countdown}
        isAuthLoading={isAuthLoading}
        loading={loading}
        locationOptions={locationOptions}
        messages={messages}
        onLocationChange={onLocationChange}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <FeebasBoard
          activeTerrain={activeTerrain}
          board={board}
          boardMinWidth={boardMinWidth}
          displayMode={displayMode}
          displayModeHotkey={displayModeHotkey}
          hotkeyCaptureError={hotkeyCaptureError}
          isHeatmapMode={isHeatmapMode}
          isHotkeyCaptureActive={isHotkeyCaptureActive}
          layoutCols={layoutCols}
          layoutRows={layoutRows}
          loading={loading}
          maxPreviousConfirmations={maxPreviousConfirmations}
          messages={messages}
          pendingAction={pendingAction}
          previousConfirmedTileCounts={previousConfirmedTileCounts}
          selectedTileId={selectedTileId}
          tileByPosition={tileByPosition}
          onDisplayModeChange={onDisplayModeChange}
          onResetHotkey={onResetHotkey}
          onStartHotkeyCapture={onStartHotkeyCapture}
          onTilePress={onTilePress}
        />

        <aside className="space-y-4">
          <FeebasStatusPanel
            board={board}
            error={error}
            loading={loading}
            messages={messages}
            totalCheckedVotes={totalCheckedVotes}
            totalConfirmedVotes={totalConfirmedVotes}
            totalPendingVotes={totalPendingVotes}
          />
          <SelectedTilePanel
            isHeatmapMode={isHeatmapMode}
            loading={loading && !board}
            messages={messages}
            pendingAction={pendingAction}
            selectedTile={selectedTile}
            selectedTileLabel={selectedTileLabel}
            onUpdateTile={onUpdateTile}
          />
          <ActivityPanel
            activityCurrentPage={activityCurrentPage}
            activityEntries={activityEntries}
            activityPageCount={activityPageCount}
            activeLocale={activeLocale}
            board={board}
            loading={loading}
            messages={messages}
            paginatedActivityEntries={paginatedActivityEntries}
            onPageChange={onActivityPageChange}
          />
        </aside>
      </section>

      <LeaderboardPanel
        activeLocale={activeLocale}
        authHref={authHref}
        authUser={authUser}
        board={board}
        isAuthLoading={isAuthLoading}
        leaderboardEntries={leaderboardEntries}
        leaderboardSort={leaderboardSort}
        loading={loading}
        messages={messages}
        onLeaderboardSortChange={onLeaderboardSortChange}
      />
    </div>
  );
}
