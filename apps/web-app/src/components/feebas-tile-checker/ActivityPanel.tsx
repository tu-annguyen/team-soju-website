import { LoadingPlaceholder } from './LoadingPlaceholder';
import type { FeebasActivityEntry, FeebasBoard, FeebasCheckerMessages } from './shared';
import { formatActorName, formatCopy, formatTimestamp, getVoteActionMessage } from './shared';

type Props = {
  activityCurrentPage: number;
  activityEntries: FeebasActivityEntry[];
  activityPageCount: number;
  activeLocale: string;
  board: FeebasBoard | null;
  loading: boolean;
  messages: FeebasCheckerMessages;
  paginatedActivityEntries: FeebasActivityEntry[];
  onPageChange: (updater: (currentPage: number) => number) => void;
};

export function ActivityPanel({
  activityCurrentPage,
  activityEntries,
  activityPageCount,
  activeLocale,
  board,
  loading,
  messages,
  paginatedActivityEntries,
  onPageChange,
}: Props) {
  return (
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
                onClick={() => onPageChange((currentPage) => Math.max(1, currentPage - 1))}
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
                onClick={() => onPageChange((currentPage) => Math.min(activityPageCount, currentPage + 1))}
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
  );
}
