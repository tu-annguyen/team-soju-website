import { FeebasVoteOverlay } from './FeebasVoteOverlay';
import type { LocationOption } from './locations';
import type { FeebasCheckerMessages, FeebasTile, VoteOverlayMode } from './shared';
import {
  getHeatmapOpacity,
  getStatusClasses,
  getTerrainClasses,
  getTileLabel,
  getVoteSummary,
} from './shared';

type Props = {
  isHeatmapMode: boolean;
  isSelected: boolean;
  loading: boolean;
  environmentOverlay?: LocationOption['environmentOverlay'];
  layoutCols: number;
  layoutRows: number;
  maxPreviousConfirmations: number;
  pendingAction: string | null;
  previousConfirmations: number;
  row: number;
  col: number;
  terrain: string;
  tile: FeebasTile | null;
  totalRows: number;
  voteOverlayMode: VoteOverlayMode;
  messages: FeebasCheckerMessages;
  onTilePress: (tile: FeebasTile) => void;
};

export function FeebasBoardTile({
  isHeatmapMode,
  isSelected,
  loading,
  environmentOverlay,
  layoutCols,
  layoutRows,
  maxPreviousConfirmations,
  pendingAction,
  previousConfirmations,
  row,
  col,
  terrain,
  tile,
  totalRows,
  voteOverlayMode,
  messages,
  onTilePress,
}: Props) {
  const terrainClasses = getTerrainClasses(terrain);
  const environmentOverlayStyle = environmentOverlay && layoutCols > 1 && layoutRows > 1
    ? {
        backgroundImage: `url(${environmentOverlay.imageUrl})`,
        backgroundPosition: `${(col / (layoutCols - 1)) * 100}% ${(row / (layoutRows - 1)) * 100}%`,
        backgroundSize: `${layoutCols * 100}% ${layoutRows * 100}%`,
        opacity: environmentOverlay.opacity,
      }
    : null;

  if (loading && !tile) {
    return (
      <div
        className={`relative aspect-square rounded-[0.35rem] border border-white/10 ${terrainClasses}`}
      >
        <div className="absolute inset-[8%] rounded-[0.3rem] bg-[linear-gradient(180deg,_rgba(255,255,255,0.18),_rgba(255,255,255,0.03))]" />
        <div className="absolute inset-[8%] animate-pulse rounded-[0.3rem] bg-slate-100/20" />
      </div>
    );
  }

  if (!tile) {
    if (environmentOverlayStyle) {
      return (
        <div
          aria-hidden="true"
          className="aspect-square rounded-[0.35rem] border border-black/5 bg-cover bg-no-repeat"
          data-testid="feebas-environment-cell"
          style={environmentOverlayStyle}
        />
      );
    }

    return (
      <div
        data-testid="feebas-terrain-cell"
        className={`aspect-square rounded-[0.35rem] border border-black/5 ${terrainClasses}`}
      />
    );
  }

  const tileLabel = getTileLabel(tile.row, tile.col, totalRows);
  const heatmapOpacity = getHeatmapOpacity(previousConfirmations, maxPreviousConfirmations);
  const buttonStatusClasses = isHeatmapMode
    ? 'bg-slate-950/20 text-white'
    : voteOverlayMode === 'pattern'
      ? 'bg-slate-950/15 text-white'
      : getStatusClasses(tile.status);

  return (
    <div className={`relative aspect-square rounded-[0.35rem] border border-white/10 ${terrainClasses}`}>
      <div className="absolute inset-[8%] rounded-[0.3rem] bg-[linear-gradient(180deg,_rgba(255,255,255,0.18),_rgba(255,255,255,0.03))]" />
      {!isHeatmapMode ? <FeebasVoteOverlay mode={voteOverlayMode} voteCounts={tile.voteCounts} /> : null}
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
        onClick={() => onTilePress(tile)}
        className={`relative z-10 flex h-full w-full flex-col items-center justify-center rounded-[0.35rem] border border-white/20 px-1 text-[0.68rem] font-semibold uppercase tracking-wide transition ${buttonStatusClasses} ${isSelected ? 'scale-[0.97] ring-2 ring-white/80' : ''} ${
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
}
