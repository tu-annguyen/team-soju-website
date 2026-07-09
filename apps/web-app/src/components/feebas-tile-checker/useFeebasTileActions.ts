import { useCallback } from 'react';
import type React from 'react';
import type {
  BoardResponse,
  FeebasBoard,
  FeebasCheckerMessages,
  FeebasTile,
  TileStatus,
} from './shared';
import { formatCountdown } from './shared';

type Params = {
  activeLocation: string;
  actorFingerprint: string;
  applyBoardUpdate: (nextBoard: FeebasBoard) => void;
  isHeatmapMode: boolean;
  messages: FeebasCheckerMessages;
  normalizedApiBaseUrl: string;
  pendingAction: string | null;
  setCountdown: React.Dispatch<React.SetStateAction<string>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setPendingAction: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedTileId: React.Dispatch<React.SetStateAction<string | null>>;
  lastFetchedCycleEndRef: React.MutableRefObject<string | null>;
  voteActorName?: string;
};

export function useFeebasTileActions({
  activeLocation,
  actorFingerprint,
  applyBoardUpdate,
  isHeatmapMode,
  messages,
  normalizedApiBaseUrl,
  pendingAction,
  setCountdown,
  setError,
  setPendingAction,
  setSelectedTileId,
  lastFetchedCycleEndRef,
  voteActorName,
}: Params) {
  const updateTile = useCallback(async (tileId: string, status: TileStatus) => {
    if (!actorFingerprint || isHeatmapMode) return;

    setPendingAction(tileId);
    setError(null);

    try {
      const response = await fetch(`${normalizedApiBaseUrl}/feebas/${activeLocation}/tiles/${tileId}`, {
        method: 'POST',
        credentials: 'include',
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
  }, [
    activeLocation,
    actorFingerprint,
    applyBoardUpdate,
    isHeatmapMode,
    lastFetchedCycleEndRef,
    messages.errors.updateTile,
    normalizedApiBaseUrl,
    setCountdown,
    setError,
    setPendingAction,
    setSelectedTileId,
    voteActorName,
  ]);

  const handleTilePress = useCallback((tile: FeebasTile) => {
    if (isHeatmapMode) return;

    setSelectedTileId(tile.tileId);

    if (
      pendingAction
      || tile.currentUserVote !== 'unchecked'
      || tile.voteCounts.pending > 0
      || tile.voteCounts.confirmed > 0
    ) {
      return;
    }

    void updateTile(tile.tileId, 'checked');
  }, [isHeatmapMode, pendingAction, setSelectedTileId, updateTile]);

  return {
    handleTilePress,
    updateTile,
  };
}
