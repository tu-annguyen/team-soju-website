import { useEffect } from 'react';
import type React from 'react';
import type { BoardResponse, FeebasBoard } from './shared';
import {
  buildFeebasLiveUpdatesUrl,
  FEEBAS_LIVE_UPDATES_MAX_RECONNECT_ATTEMPTS,
  FEEBAS_LIVE_UPDATES_RECONNECT_MS,
  formatCountdown,
} from './shared';

type Params = {
  activeLocation: string;
  actorFingerprint: string;
  isAuthLoading: boolean;
  liveUpdatesDisconnectedMessage: string;
  normalizedApiBaseUrl: string;
  lastFetchedCycleEndRef: React.MutableRefObject<string | null>;
  resetRefreshInFlightRef: React.MutableRefObject<boolean>;
  applyBoardUpdate: (nextBoard: FeebasBoard) => void;
  clearResetRetryTimeout: () => void;
  setCountdown: React.Dispatch<React.SetStateAction<string>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
};

export function useFeebasLiveUpdates({
  activeLocation,
  actorFingerprint,
  isAuthLoading,
  liveUpdatesDisconnectedMessage,
  normalizedApiBaseUrl,
  lastFetchedCycleEndRef,
  resetRefreshInFlightRef,
  applyBoardUpdate,
  clearResetRetryTimeout,
  setCountdown,
  setError,
}: Params) {
  useEffect(() => {
    if (typeof WebSocket === 'undefined') return undefined;
    if (!actorFingerprint || isAuthLoading) return undefined;

    let isStopped = false;
    let reconnectAttempts = 0;
    let reconnectTimeout: number | null = null;
    let liveUpdatesSocket: WebSocket | null = null;

    const clearReconnectTimeout = () => {
      if (reconnectTimeout !== null) {
        window.clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    const connect = () => {
      if (isStopped) return;

      const socket = new WebSocket(buildFeebasLiveUpdatesUrl(normalizedApiBaseUrl, activeLocation, actorFingerprint));
      liveUpdatesSocket = socket;

      socket.onopen = () => {
        reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        if (socket !== liveUpdatesSocket || isStopped) return;

        try {
          const payload: BoardResponse = JSON.parse(String(event.data));
          if (payload.success) {
            reconnectAttempts = 0;
            applyBoardUpdate(payload.data);
            setCountdown(formatCountdown(payload.data.cycleEnd));
            lastFetchedCycleEndRef.current = payload.data.cycleEnd;
            resetRefreshInFlightRef.current = false;
            clearResetRetryTimeout();
            setError(null);
          }
        } catch {
          // Ignore malformed event payloads and rely on the next valid update.
        }
      };

      socket.onerror = () => {
        if (!isStopped && socket === liveUpdatesSocket) {
          setError((currentError) => currentError || liveUpdatesDisconnectedMessage);
          socket.close();
        }
      };

      socket.onclose = () => {
        if (isStopped || socket !== liveUpdatesSocket) return;

        setError((currentError) => currentError || liveUpdatesDisconnectedMessage);
        clearReconnectTimeout();

        if (reconnectAttempts >= FEEBAS_LIVE_UPDATES_MAX_RECONNECT_ATTEMPTS) {
          return;
        }

        const retryDelay = FEEBAS_LIVE_UPDATES_RECONNECT_MS * (2 ** reconnectAttempts);
        reconnectAttempts += 1;
        reconnectTimeout = window.setTimeout(connect, retryDelay);
      };
    };

    connect();

    return () => {
      isStopped = true;
      clearReconnectTimeout();
      liveUpdatesSocket?.close();
    };
  }, [
    activeLocation,
    actorFingerprint,
    applyBoardUpdate,
    clearResetRetryTimeout,
    isAuthLoading,
    lastFetchedCycleEndRef,
    liveUpdatesDisconnectedMessage,
    normalizedApiBaseUrl,
    resetRefreshInFlightRef,
    setCountdown,
    setError,
  ]);
}
