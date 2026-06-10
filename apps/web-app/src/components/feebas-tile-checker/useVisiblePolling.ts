import { useEffect } from 'react';

type Params = {
  enabled: boolean;
  intervalMs: number;
  onPoll: () => void;
};

export function useVisiblePolling({ enabled, intervalMs, onPoll }: Params) {
  useEffect(() => {
    if (!enabled) return undefined;

    let timeout: number | null = null;

    const clearPoll = () => {
      if (timeout !== null) {
        window.clearTimeout(timeout);
        timeout = null;
      }
    };

    const schedulePoll = () => {
      clearPoll();
      if (document.hidden) return;

      timeout = window.setTimeout(() => {
        timeout = null;
        onPoll();
        schedulePoll();
      }, intervalMs);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearPoll();
        return;
      }

      onPoll();
      schedulePoll();
    };

    schedulePoll();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearPoll();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, intervalMs, onPoll]);
}
