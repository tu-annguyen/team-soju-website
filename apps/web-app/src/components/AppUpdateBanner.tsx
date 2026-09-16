import { useEffect, useState } from 'react';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

type Props = {
  currentBuildId: string;
  message: string;
  updateLabel: string;
  versionUrl?: string;
  reloadPage?: () => void;
};

type VersionManifest = {
  buildId: string;
};

function isVersionManifest(value: unknown): value is VersionManifest {
  if (typeof value !== 'object' || value === null || !('buildId' in value)) {
    return false;
  }

  return typeof value.buildId === 'string' && value.buildId.trim().length > 0;
}

const AppUpdateBanner = ({
  currentBuildId,
  message,
  updateLabel,
  versionUrl = '/version.json',
  reloadPage = () => window.location.reload(),
}: Props) => {
  const [isOutdated, setIsOutdated] = useState(false);

  useEffect(() => {
    let disposed = false;
    let requestInFlight = false;
    let updateDetected = false;

    const checkForUpdate = async () => {
      if (
        disposed ||
        requestInFlight ||
        updateDetected ||
        document.visibilityState === 'hidden'
      ) {
        return;
      }

      requestInFlight = true;

      try {
        const separator = versionUrl.includes('?') ? '&' : '?';
        const response = await fetch(`${versionUrl}${separator}t=${Date.now()}`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          return;
        }

        const manifest: unknown = await response.json();

        if (
          !disposed &&
          isVersionManifest(manifest) &&
          manifest.buildId !== currentBuildId
        ) {
          updateDetected = true;
          setIsOutdated(true);
        }
      } catch {
        // A transient failure should not interrupt the app; the next scheduled check retries.
      } finally {
        requestInFlight = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdate();
      }
    };

    void checkForUpdate();
    const intervalId = window.setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentBuildId, versionUrl]);

  if (!isOutdated) {
    return null;
  }

  return (
    <div
      className="sticky top-14 z-40 border-y border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950 dark:text-amber-50"
      role="status"
      aria-live="polite"
    >
      <div className="container flex items-center justify-center gap-3 py-3 text-center text-sm">
        <span className="font-medium">{message}</span>
        <button
          type="button"
          className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400 dark:focus:ring-offset-amber-950"
          onClick={reloadPage}
        >
          {updateLabel}
        </button>
      </div>
    </div>
  );
};

export default AppUpdateBanner;
