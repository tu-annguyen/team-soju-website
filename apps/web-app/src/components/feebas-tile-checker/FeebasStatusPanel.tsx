import { LoadingPlaceholder } from './LoadingPlaceholder';
import type { FeebasBoard, FeebasCheckerMessages } from './shared';

type Props = {
  board: FeebasBoard | null;
  error: string | null;
  loading: boolean;
  messages: FeebasCheckerMessages;
  totalCheckedVotes: number;
  totalConfirmedVotes: number;
  totalPendingVotes: number;
};

export function FeebasStatusPanel({
  board,
  error,
  loading,
  messages,
  totalCheckedVotes,
  totalConfirmedVotes,
  totalPendingVotes,
}: Props) {
  return (
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
  );
}
