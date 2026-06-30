import { useCallback } from 'react';
import type React from 'react';
import type {
  BoardResponse,
  FeebasBoard,
  FeebasCheckerMessages,
  Route119Weather,
} from './shared';
import { formatCountdown } from './shared';

type Params = {
  activeLocation: string;
  actorFingerprint: string;
  applyBoardUpdate: (nextBoard: FeebasBoard) => void;
  messages: FeebasCheckerMessages;
  normalizedApiBaseUrl: string;
  setCountdown: React.Dispatch<React.SetStateAction<string>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setPendingAction: React.Dispatch<React.SetStateAction<string | null>>;
  lastFetchedCycleEndRef: React.MutableRefObject<string | null>;
  voteActorName?: string;
};

export function useFeebasWeatherActions({
  activeLocation,
  actorFingerprint,
  applyBoardUpdate,
  messages,
  normalizedApiBaseUrl,
  setCountdown,
  setError,
  setPendingAction,
  lastFetchedCycleEndRef,
  voteActorName,
}: Params) {
  return useCallback(async (weather: Route119Weather) => {
    if (!actorFingerprint) return;

    setPendingAction(`weather:${weather}`);
    setError(null);

    try {
      const response = await fetch(`${normalizedApiBaseUrl}/feebas/${activeLocation}/weather`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          weather,
          actorFingerprint,
          actorName: voteActorName || undefined,
        }),
      });
      const payload: BoardResponse = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || messages.errors.updateWeather);
      }

      applyBoardUpdate(payload.data);
      lastFetchedCycleEndRef.current = payload.data.cycleEnd;
      setCountdown(formatCountdown(payload.data.cycleEnd));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : messages.errors.updateWeather);
    } finally {
      setPendingAction(null);
    }
  }, [
    activeLocation,
    actorFingerprint,
    applyBoardUpdate,
    lastFetchedCycleEndRef,
    messages.errors.updateWeather,
    normalizedApiBaseUrl,
    setCountdown,
    setError,
    setPendingAction,
    voteActorName,
  ]);
}
