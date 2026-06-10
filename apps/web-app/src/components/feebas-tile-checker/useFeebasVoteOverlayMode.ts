import { useCallback, useState } from 'react';
import {
  getStoredFeebasVoteOverlayMode,
  storeFeebasVoteOverlayMode,
  type VoteOverlayMode,
} from './shared';

export function useFeebasVoteOverlayMode() {
  const [voteOverlayMode, setVoteOverlayModeState] = useState(getStoredFeebasVoteOverlayMode);

  const setVoteOverlayMode = useCallback((nextMode: VoteOverlayMode) => {
    setVoteOverlayModeState(nextMode);
    storeFeebasVoteOverlayMode(nextMode);
  }, []);

  return {
    voteOverlayMode,
    setVoteOverlayMode,
  };
}
