import { useEffect } from 'react';
import type React from 'react';
import type { FeebasActivityDelta, FeebasBoard, FeebasLiveUpdateResponse, FeebasTileDelta } from './shared';
import {
  buildFeebasLiveUpdatesUrl,
  FEEBAS_HIDDEN_SOCKET_IDLE_MS,
  FEEBAS_LIVE_UPDATES_MAX_RECONNECT_ATTEMPTS,
  FEEBAS_LIVE_UPDATES_RECONNECT_MS,
  formatCountdown,
  LAST_ACTIVITY_ID_STORAGE_PREFIX,
} from './shared';

type Params = {
  activeLocation: string | null;
  actorFingerprint: string;
  isAuthLoading: boolean;
  liveUpdatesDisconnectedMessage: string;
  normalizedApiBaseUrl: string;
  lastFetchedCycleEndRef: React.MutableRefObject<string | null>;
  resetRefreshInFlightRef: React.MutableRefObject<boolean>;
  applyBoardUpdate: (nextBoard: FeebasBoard) => void;
  applyActivityDelta?: (activityDelta: FeebasActivityDelta) => void;
  applyTileDelta?: (tileDelta: FeebasTileDelta) => void;
  clearResetRetryTimeout: () => void;
  onResume?: () => void;
  setCountdown: React.Dispatch<React.SetStateAction<string>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
};

function getActivityStorageKey(location: string) {
  return `${LAST_ACTIVITY_ID_STORAGE_PREFIX}:${location}`;
}

function normalizeActivityId(value: unknown) {
  const activityId = Number(value);
  return Number.isInteger(activityId) && activityId > 0 ? activityId : null;
}

function getLatestActivityId(activity: { id: number }[] | undefined) {
  return (activity || []).reduce<number | null>((latestActivityId, entry) => {
    const activityId = normalizeActivityId(entry.id);
    if (!activityId) return latestActivityId;
    return Math.max(latestActivityId || 0, activityId);
  }, null);
}

function readStoredLastActivityId(location: string) {
  try {
    return normalizeActivityId(localStorage.getItem(getActivityStorageKey(location)));
  } catch {
    return null;
  }
}

function storeLastActivityId(location: string, activityId: number) {
  try {
    localStorage.setItem(getActivityStorageKey(location), String(activityId));
  } catch {
    // Ignore storage write failures; the in-memory cursor still covers this session.
  }
}

export function useFeebasLiveUpdates({
  activeLocation,
  actorFingerprint,
  isAuthLoading,
  liveUpdatesDisconnectedMessage,
  normalizedApiBaseUrl,
  lastFetchedCycleEndRef,
  resetRefreshInFlightRef,
  applyBoardUpdate,
  applyActivityDelta,
  applyTileDelta,
  clearResetRetryTimeout,
  onResume,
  setCountdown,
  setError,
}: Params) {
  useEffect(() => {
    if (typeof WebSocket === 'undefined') return undefined;
    if (!activeLocation) return undefined;
    if (!actorFingerprint || isAuthLoading) return undefined;

    let isStopped = false;
    let reconnectAttempts = 0;
    let reconnectTimeout: number | null = null;
    let hiddenIdleTimeout: number | null = null;
    let isHiddenPaused = false;
    let liveUpdatesSocket: WebSocket | null = null;
    let lastActivityId = readStoredLastActivityId(activeLocation);

    const rememberLastActivityId = (activityId: number | null) => {
      if (!activityId || activityId <= (lastActivityId || 0)) return;
      lastActivityId = activityId;
      storeLastActivityId(activeLocation, activityId);
    };

    const clearReconnectTimeout = () => {
      if (reconnectTimeout !== null) {
        window.clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    const clearHiddenIdleTimeout = () => {
      if (hiddenIdleTimeout !== null) {
        window.clearTimeout(hiddenIdleTimeout);
        hiddenIdleTimeout = null;
      }
    };

    const connect = () => {
      if (isStopped) return;
      if (typeof document !== 'undefined' && document.hidden) return;

      const socket = new WebSocket(buildFeebasLiveUpdatesUrl(
        normalizedApiBaseUrl,
        activeLocation,
        actorFingerprint,
        lastActivityId
      ));
      liveUpdatesSocket = socket;

      socket.onopen = () => {
        reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        if (socket !== liveUpdatesSocket || isStopped) return;

        try {
          const payload: FeebasLiveUpdateResponse = JSON.parse(String(event.data));
          if (payload.success) {
            reconnectAttempts = 0;

            if (payload.type === 'activity_delta') {
              rememberLastActivityId(getLatestActivityId(payload.data.activity));
              applyActivityDelta?.(payload.data);
              setError(null);
              return;
            }

            if (payload.type === 'tile_delta') {
              rememberLastActivityId(getLatestActivityId(payload.data.activity));
              if (applyTileDelta) {
                applyTileDelta(payload.data);
              } else {
                applyActivityDelta?.(payload.data);
              }
              setError(null);
              return;
            }

            rememberLastActivityId(getLatestActivityId(payload.data.activity));
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

        if (isHiddenPaused) {
          return;
        }

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

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearHiddenIdleTimeout();
        hiddenIdleTimeout = window.setTimeout(() => {
          isHiddenPaused = true;
          liveUpdatesSocket?.close();
        }, FEEBAS_HIDDEN_SOCKET_IDLE_MS);
        return;
      }

      clearHiddenIdleTimeout();
      const shouldReconnect = isHiddenPaused || !liveUpdatesSocket || liveUpdatesSocket.readyState === WebSocket.CLOSED;
      isHiddenPaused = false;
      clearReconnectTimeout();
      if (shouldReconnect) {
        onResume?.();
        connect();
      }
    };

    connect();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isStopped = true;
      clearReconnectTimeout();
      clearHiddenIdleTimeout();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      liveUpdatesSocket?.close();
    };
  }, [
    activeLocation,
    actorFingerprint,
    applyActivityDelta,
    applyBoardUpdate,
    applyTileDelta,
    clearResetRetryTimeout,
    isAuthLoading,
    lastFetchedCycleEndRef,
    liveUpdatesDisconnectedMessage,
    normalizedApiBaseUrl,
    onResume,
    resetRefreshInFlightRef,
    setCountdown,
    setError,
  ]);
}
