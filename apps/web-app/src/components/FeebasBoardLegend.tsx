export type FeebasBoardDisplayMode = 'voting' | 'heatmap';

type FeebasBoardLegendMessages = {
  general: {
    scrollHint: string;
  };
  heatmap: {
    description: string;
    heatmapMode: string;
    highLegend: string;
    lowLegend: string;
    toggleLabel: string;
    votingMode: string;
  };
  status: {
    checked: string;
    confirmed: string;
    pending: string;
    unchecked: string;
  };
};

type Props = {
  displayMode: FeebasBoardDisplayMode;
  messages: FeebasBoardLegendMessages;
  onDisplayModeChange: (displayMode: FeebasBoardDisplayMode) => void;
  placement?: 'top' | 'bottom';
};

const FeebasBoardLegend = ({
  displayMode,
  messages,
  onDisplayModeChange,
  placement = 'top',
}: Props) => {
  const borderClass = placement === 'bottom' ? 'border-t' : 'border-b';

  return (
    <div
      className={`${borderClass} border-slate-200 bg-gradient-to-br from-sky-100 via-cyan-100 to-teal-100 p-4 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800`}
    >
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
            onClick={() => onDisplayModeChange('voting')}
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
            onClick={() => onDisplayModeChange('heatmap')}
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
  );
};

export default FeebasBoardLegend;
