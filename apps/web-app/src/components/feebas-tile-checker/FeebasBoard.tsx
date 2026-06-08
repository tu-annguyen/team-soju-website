import type { Dispatch, SetStateAction } from 'react';
import FeebasBoardLegend from './FeebasBoardLegend';
import { FeebasBoardTile } from './FeebasBoardTile';
import type { BoardDisplayMode, FeebasBoard as FeebasBoardType, FeebasCheckerMessages, FeebasTile } from './shared';

type Props = {
  activeTerrain: readonly (readonly string[])[];
  board: FeebasBoardType | null;
  boardMinWidth: string;
  displayMode: BoardDisplayMode;
  displayModeHotkey: string;
  hotkeyCaptureError: string | null;
  isHeatmapMode: boolean;
  isHotkeyCaptureActive: boolean;
  layoutCols: number;
  layoutRows: number;
  loading: boolean;
  maxPreviousConfirmations: number;
  messages: FeebasCheckerMessages;
  pendingAction: string | null;
  previousConfirmedTileCounts: Map<string, number>;
  selectedTileId: string | null;
  tileByPosition: Map<string, FeebasTile>;
  onDisplayModeChange: Dispatch<SetStateAction<BoardDisplayMode>>;
  onResetHotkey: () => void;
  onStartHotkeyCapture: () => void;
  onTilePress: (tile: FeebasTile) => void;
};

export function FeebasBoard({
  activeTerrain,
  board,
  boardMinWidth,
  displayMode,
  displayModeHotkey,
  hotkeyCaptureError,
  isHeatmapMode,
  isHotkeyCaptureActive,
  layoutCols,
  layoutRows,
  loading,
  maxPreviousConfirmations,
  messages,
  pendingAction,
  previousConfirmedTileCounts,
  selectedTileId,
  tileByPosition,
  onDisplayModeChange,
  onResetHotkey,
  onStartHotkeyCapture,
  onTilePress,
}: Props) {
  return (
    <div className="card overflow-hidden">
      <FeebasBoardLegend
        displayMode={displayMode}
        displayModeHotkey={displayModeHotkey}
        hotkeyCaptureError={hotkeyCaptureError}
        isHotkeyCaptureActive={isHotkeyCaptureActive}
        messages={messages}
        onResetHotkey={onResetHotkey}
        onDisplayModeChange={onDisplayModeChange}
        onStartHotkeyCapture={onStartHotkeyCapture}
      />

      <div className="overflow-x-auto overscroll-x-contain bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.35),_transparent_30%),linear-gradient(180deg,_#d6f2f4_0%,_#8fd4e8_45%,_#4d8bc6_100%)] p-4">
        <div
          className="grid gap-1 rounded-2xl border border-sky-100/50 bg-sky-950/10 p-2 shadow-[0_18px_45px_rgba(20,55,107,0.24)] backdrop-blur-sm"
          style={{
            minWidth: boardMinWidth,
            gridTemplateColumns: `repeat(${layoutCols}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: layoutRows * layoutCols }, (_, index) => {
            const row = Math.floor(index / layoutCols);
            const col = index % layoutCols;
            const tile = tileByPosition.get(`${row}-${col}`) || null;
            const terrain = activeTerrain[row]?.[col] || 'water';

            return (
              <FeebasBoardTile
                key={tile?.tileId || `${row}-${col}`}
                isHeatmapMode={isHeatmapMode}
                isSelected={Boolean(tile && selectedTileId === tile.tileId)}
                loading={loading && !board}
                maxPreviousConfirmations={maxPreviousConfirmations}
                messages={messages}
                pendingAction={pendingAction}
                previousConfirmations={tile ? previousConfirmedTileCounts.get(tile.tileId) || 0 : 0}
                row={row}
                col={col}
                terrain={terrain}
                tile={tile}
                totalRows={board?.layout.rows || activeTerrain.length}
                onTilePress={onTilePress}
              />
            );
          })}
        </div>
      </div>

      {layoutRows > 25 ? (
        <FeebasBoardLegend
          displayMode={displayMode}
          displayModeHotkey={displayModeHotkey}
          hotkeyCaptureError={hotkeyCaptureError}
          isHotkeyCaptureActive={isHotkeyCaptureActive}
          messages={messages}
          onResetHotkey={onResetHotkey}
          onDisplayModeChange={onDisplayModeChange}
          onStartHotkeyCapture={onStartHotkeyCapture}
          placement="bottom"
        />
      ) : null}
    </div>
  );
}
