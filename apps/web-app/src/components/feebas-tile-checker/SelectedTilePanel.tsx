import { LoadingPlaceholder } from './LoadingPlaceholder';
import type { FeebasCheckerMessages, FeebasTile, TileStatus } from './shared';
import { formatCopy, getStatusLabel } from './shared';

type Props = {
  isHeatmapMode: boolean;
  loading: boolean;
  messages: FeebasCheckerMessages;
  pendingAction: string | null;
  selectedTile: FeebasTile | null;
  selectedTileLabel: string | null;
  onUpdateTile: (tileId: string, status: TileStatus) => void;
};

export function SelectedTilePanel({
  isHeatmapMode,
  loading,
  messages,
  pendingAction,
  selectedTile,
  selectedTileLabel,
  onUpdateTile,
}: Props) {
  const selectedTileCurrentVote = selectedTile?.currentUserVote || 'unchecked';
  const selectedTileHasPending = Boolean(selectedTile && selectedTile.voteCounts.pending > 0);
  const selectedTileIsPendingOwner = selectedTileCurrentVote === 'pending';
  const selectedTileHasNoVote = selectedTileCurrentVote === 'unchecked';
  const canConfirmSelectedTile = Boolean(
    selectedTile
    && selectedTileHasPending
    && !selectedTileIsPendingOwner
    && selectedTileCurrentVote !== 'confirmed'
  );

  return (
    <div className="card p-5">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white">{messages.selectedTile.heading}</h3>
      {loading && !selectedTile ? (
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
              onClick={() => onUpdateTile(selectedTile.tileId, 'checked')}
              className="btn bg-rose-600 text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isHeatmapMode || pendingAction === selectedTile.tileId || selectedTile.currentUserVote === 'checked'}
            >
              {messages.selectedTile.noFeebas}
            </button>
            <button
              type="button"
              onClick={() => onUpdateTile(selectedTile.tileId, 'pending')}
              className="btn bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isHeatmapMode || pendingAction === selectedTile.tileId || selectedTileIsPendingOwner || (selectedTileHasPending && !selectedTileIsPendingOwner)}
            >
              {messages.selectedTile.feebasFound}
            </button>
            <button
              type="button"
              onClick={() => onUpdateTile(selectedTile.tileId, 'confirmed')}
              className="btn bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isHeatmapMode || pendingAction === selectedTile.tileId || !canConfirmSelectedTile}
            >
              {messages.selectedTile.feebasConfirmed}
            </button>
            <button
              type="button"
              onClick={() => onUpdateTile(selectedTile.tileId, 'unchecked')}
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
  );
}
