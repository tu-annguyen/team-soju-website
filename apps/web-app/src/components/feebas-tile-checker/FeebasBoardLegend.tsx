import { formatFeebasDisplayModeHotkey } from '../../utils/feebasHotkey';
import type { VoteOverlayMode } from './shared';
import {
  getVotePatternStyle,
  VOTE_OVERLAY_STATUSES,
  type VoteOverlayStatus,
} from './feebasVoteOverlayStyles';

export type FeebasBoardDisplayMode = 'voting' | 'heatmap';

type FeebasBoardLegendMessages = {
  accessibility: {
    patternOverlayDescription: string;
    patternOverlayLabel: string;
  };
  general: {
    scrollHint: string;
  };
  heatmap: {
    changeShortcut: string;
    invalidShortcut: string;
    resetShortcut: string;
    shortcutCaptureHint: string;
    shortcutLabel: string;
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
  displayModeHotkey: string;
  hotkeyCaptureError: string | null;
  isHotkeyCaptureActive: boolean;
  messages: FeebasBoardLegendMessages;
  voteOverlayMode: VoteOverlayMode;
  onResetHotkey: () => void;
  onDisplayModeChange: (displayMode: FeebasBoardDisplayMode) => void;
  onStartHotkeyCapture: () => void;
  onVoteOverlayModeChange: (mode: VoteOverlayMode) => void;
  placement?: 'top' | 'bottom';
};

function PatternLegendSwatch({
  label,
  status,
}: {
  label: string;
  status: VoteOverlayStatus;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-slate-900 ring-1 ring-slate-300 dark:bg-slate-950/70 dark:text-white dark:ring-slate-700">
      <span
        aria-hidden="true"
        className="h-5 w-5 rounded-full ring-1 ring-white/50"
        style={getVotePatternStyle(status)}
      />
      {label}
    </span>
  );
}

const FeebasBoardLegend = ({
  displayMode,
  displayModeHotkey,
  hotkeyCaptureError,
  isHotkeyCaptureActive,
  messages,
  voteOverlayMode,
  onResetHotkey,
  onDisplayModeChange,
  onStartHotkeyCapture,
  onVoteOverlayModeChange,
  placement = 'top',
}: Props) => {
  const borderClass = placement === 'bottom' ? 'border-t' : 'border-b';
  const formattedHotkey = formatFeebasDisplayModeHotkey(displayModeHotkey);
  const shortcutLabel = messages.heatmap.shortcutLabel.replace('{key}', formattedHotkey);
  const isPatternOverlayMode = voteOverlayMode === 'pattern';
  const patternLegendLabels: Record<VoteOverlayStatus, string> = {
    checked: messages.status.checked,
    pending: messages.status.pending,
    confirmed: messages.status.confirmed,
  };

  return (
    <div
      className={`${borderClass} border-slate-200 bg-gradient-to-br from-sky-100 via-cyan-100 to-teal-100 p-4 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-sm">
          {displayMode === 'voting' ? (
            isPatternOverlayMode ? (
              <>
                <span className="rounded-full bg-slate-500 px-3 py-1 text-white">{messages.status.unchecked}</span>
                {VOTE_OVERLAY_STATUSES.map((status) => (
                  <PatternLegendSwatch
                    key={status}
                    label={patternLegendLabels[status]}
                    status={status}
                  />
                ))}
              </>
            ) : (
              <>
                <span className="rounded-full bg-slate-500 px-3 py-1 text-white">{messages.status.unchecked}</span>
                <span className="rounded-full bg-rose-600 px-3 py-1 text-white">{messages.status.checked}</span>
                <span className="rounded-full bg-amber-400 px-3 py-1 text-slate-950">{messages.status.pending}</span>
                <span className="rounded-full bg-emerald-500 px-3 py-1 text-slate-950">{messages.status.confirmed}</span>
              </>
            )
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
        {displayMode === 'voting' ? (
          <label
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-200"
            title={messages.accessibility.patternOverlayDescription}
          >
            <input
              type="checkbox"
              checked={isPatternOverlayMode}
              className="peer sr-only"
              onChange={(event) => onVoteOverlayModeChange(event.target.checked ? 'pattern' : 'color')}
            />
            <span className="relative h-5 w-9 rounded-full bg-slate-300 transition peer-checked:bg-slate-900 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-slate-900 dark:bg-slate-700 dark:peer-checked:bg-white dark:peer-focus-visible:outline-white">
              <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition dark:bg-slate-950 ${isPatternOverlayMode ? 'translate-x-4' : ''}`} />
            </span>
            <span>{messages.accessibility.patternOverlayLabel}</span>
          </label>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
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
          <div
            className="inline-flex flex-wrap items-center gap-1 rounded-full border border-slate-300 bg-white/80 p-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-200"
            aria-live="polite"
          >
            <span className="px-2">{shortcutLabel}</span>
            <button
              type="button"
              onClick={onStartHotkeyCapture}
              className={`rounded-full px-2 py-1 transition ${
                isHotkeyCaptureActive
                  ? 'bg-amber-400 text-slate-950'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {isHotkeyCaptureActive ? messages.heatmap.shortcutCaptureHint : messages.heatmap.changeShortcut}
            </button>
            <button
              type="button"
              onClick={onResetHotkey}
              className="rounded-full px-2 py-1 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {messages.heatmap.resetShortcut}
            </button>
          </div>
        </div>
      </div>
      {hotkeyCaptureError ? (
        <p className="mt-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
          {hotkeyCaptureError}
        </p>
      ) : null}
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
