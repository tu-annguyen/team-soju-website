import React, { useEffect, useMemo, useRef, useState } from 'react';

type TileStatus = 'unchecked' | 'checked' | 'pending' | 'confirmed';

type FeebasTile = {
  tileId: string;
  label: string;
  row: number;
  col: number;
  status: TileStatus;
  updatedAt: string | null;
  updatedByName: string | null;
  pendingReportedByName: string | null;
  pendingReportedByFingerprint: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
};

type FeebasBoard = {
  location: string;
  displayName: string;
  description: string;
  cycleStart: string;
  cycleEnd: string;
  serverTime: string;
  resetIntervalMinutes: number;
  requiresDistinctConfirmation: boolean;
  confirmedTileId: string | null;
  isLocked: boolean;
  layout: {
    rows: number;
    cols: number;
  };
  tiles: FeebasTile[];
};

type BoardResponse = {
  success: boolean;
  data: FeebasBoard;
  message?: string;
};

type Props = {
  apiBaseUrl: string;
  location?: string;
};

const DEFAULT_LOCATION = 'route-119-main';
const CLIENT_ID_STORAGE_KEY = 'feebas-tile-checker-client-id';
const DISPLAY_NAME_STORAGE_KEY = 'feebas-tile-checker-display-name';

function getStatusClasses(status: TileStatus) {
  return ({
    unchecked: 'bg-slate-500 hover:bg-slate-400 text-white',
    checked: 'bg-rose-600 hover:bg-rose-500 text-white',
    pending: 'bg-amber-400 hover:bg-amber-300 text-slate-900',
    confirmed: 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-200',
  }[status]);
}

function getStatusLabel(status: TileStatus) {
  return ({
    unchecked: 'Unchecked',
    checked: 'Checked',
    pending: 'Pending',
    confirmed: 'Confirmed',
  }[status]);
}

function formatCountdown(targetIso: string | null) {
  if (!targetIso) {
    return '--:--';
  }

  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) {
    return '00:00';
  }

  const totalSeconds = Math.floor(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function createClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const FeebasTileChecker = ({ apiBaseUrl, location = DEFAULT_LOCATION }: Props) => {
  const [board, setBoard] = useState<FeebasBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('--:--');
  const lastFetchedCycleEndRef = useRef<string | null>(null);
  const resetRefreshInFlightRef = useRef(false);

  const fetchBoard = async () => {
    const response = await fetch(`${apiBaseUrl}/feebas/${location}`);
    const payload: BoardResponse = await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(payload.message || 'Unable to load the Feebas board');
    }

    setBoard(payload.data);
    setCountdown(formatCountdown(payload.data.cycleEnd));
    lastFetchedCycleEndRef.current = payload.data.cycleEnd;
  };

  useEffect(() => {
    try {
      const storedClientId = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
      const resolvedClientId = storedClientId || createClientId();
      localStorage.setItem(CLIENT_ID_STORAGE_KEY, resolvedClientId);
      setClientId(resolvedClientId);

      const storedName = localStorage.getItem(DISPLAY_NAME_STORAGE_KEY) || '';
      setDisplayName(storedName);
    } catch {
      setClientId(createClientId());
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        await fetchBoard();
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to load the Feebas board');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [apiBaseUrl, location]);

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      return undefined;
    }

    const eventSource = new EventSource(`${apiBaseUrl}/feebas/${location}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const payload: BoardResponse = JSON.parse(event.data);
        if (payload.success) {
          setBoard(payload.data);
          setCountdown(formatCountdown(payload.data.cycleEnd));
          lastFetchedCycleEndRef.current = payload.data.cycleEnd;
          resetRefreshInFlightRef.current = false;
          setError(null);
        }
      } catch {
        // Ignore malformed event payloads and rely on the next valid update.
      }
    };

    eventSource.onerror = () => {
      setError((currentError) => currentError || 'Live updates disconnected. The board will refresh again shortly.');
    };

    return () => {
      eventSource.close();
    };
  }, [apiBaseUrl, location]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(formatCountdown(lastFetchedCycleEndRef.current));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (countdown !== '00:00' || resetRefreshInFlightRef.current) {
      return;
    }

    resetRefreshInFlightRef.current = true;
    fetchBoard().catch((nextError) => {
      resetRefreshInFlightRef.current = false;
      setError(nextError instanceof Error ? nextError.message : 'Unable to refresh the Feebas board');
    });
  }, [countdown]);

  useEffect(() => {
    try {
      localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, displayName.trim());
    } catch {
      // Ignore storage write failures.
    }
  }, [displayName]);

  const tileMap = useMemo(() => {
    if (!board) {
      return new Map<string, FeebasTile>();
    }

    return new Map(board.tiles.map((tile) => [tile.tileId, tile]));
  }, [board]);

  const selectedTile = selectedTileId ? tileMap.get(selectedTileId) || null : null;
  const pendingTileCount = board?.tiles.filter((tile) => tile.status === 'pending').length || 0;
  const checkedTileCount = board?.tiles.filter((tile) => tile.status === 'checked').length || 0;
  const confirmedTile = board?.tiles.find((tile) => tile.status === 'confirmed') || null;
  const canConfirmSelectedTile = Boolean(
    selectedTile &&
    selectedTile.status === 'pending' &&
    clientId &&
    selectedTile.pendingReportedByFingerprint !== clientId
  );

  const updateTile = async (tileId: string, status: TileStatus) => {
    if (!clientId) {
      return;
    }

    setPendingAction(tileId);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/feebas/${location}/tiles/${tileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          actorFingerprint: clientId,
          actorName: displayName.trim() || undefined,
        }),
      });
      const payload: BoardResponse = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Unable to update the Feebas tile');
      }

      setBoard(payload.data);
      setSelectedTileId(tileId);
      lastFetchedCycleEndRef.current = payload.data.cycleEnd;
      setCountdown(formatCountdown(payload.data.cycleEnd));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to update the Feebas tile');
    } finally {
      setPendingAction(null);
    }
  };

  const handleTilePress = (tile: FeebasTile) => {
    setSelectedTileId(tile.tileId);

    if (board?.isLocked || pendingAction) {
      return;
    }

    if (tile.status === 'unchecked') {
      updateTile(tile.tileId, 'checked');
      return;
    }

    if (tile.status === 'checked') {
      updateTile(tile.tileId, 'unchecked');
    }
  };

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <span className="text-gray-600 dark:text-gray-300">Loading the Feebas board...</span>
      </div>
    );
  }

  if (error && !board) {
    return (
      <div className="card p-8 text-center">
        <span className="text-rose-600 dark:text-rose-300">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              {board?.displayName || 'Feebas Tile Checker'}
            </h2>
            <p className="mt-2 max-w-3xl text-gray-600 dark:text-gray-300">
              Mark tiles as checked, report a likely Feebas tile as pending, and have a second player confirm it.
              Once confirmed, the board locks until the next in-game reset.
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl bg-slate-100 p-4 dark:bg-slate-900/70">
            <span className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Next Reset
            </span>
            <span className="font-display text-3xl text-slate-900 dark:text-white">{countdown}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Resets every {board?.resetIntervalMinutes || 45} real-time minutes
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Optional display name</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value.slice(0, 40))}
              placeholder="Anonymous Feebas Hunter"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-primary-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
            Confirmation requires a second distinct browser. Names are optional and not verified.
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-br from-sky-100 via-cyan-100 to-teal-100 p-4 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-slate-500 px-3 py-1 text-white">Unchecked</span>
              <span className="rounded-full bg-rose-600 px-3 py-1 text-white">Checked</span>
              <span className="rounded-full bg-amber-400 px-3 py-1 text-slate-950">Pending</span>
              <span className="rounded-full bg-emerald-500 px-3 py-1 text-slate-950">Confirmed</span>
            </div>
          </div>

          <div className="overflow-x-auto bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.5),_transparent_30%),linear-gradient(180deg,_#8fd4e8_0%,_#2f7dc0_100%)] p-4">
            <div
              className="mx-auto grid max-w-3xl gap-1 rounded-2xl border border-sky-100/40 bg-sky-950/20 p-2 backdrop-blur-sm"
              style={{
                gridTemplateColumns: `repeat(${board?.layout.cols || 1}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: (board?.layout.rows || 0) * (board?.layout.cols || 0) }, (_, index) => {
                const row = Math.floor(index / (board?.layout.cols || 1));
                const col = index % (board?.layout.cols || 1);
                const tile = board?.tiles.find((entry) => entry.row === row && entry.col === col) || null;

                if (!tile) {
                  return <div key={`void-${row}-${col}`} className="aspect-square rounded-lg bg-transparent" />;
                }

                const isSelected = selectedTileId === tile.tileId;

                return (
                  <button
                    key={tile.tileId}
                    type="button"
                    onClick={() => handleTilePress(tile)}
                    className={`aspect-square min-h-[2.75rem] rounded-lg border border-white/20 text-[0.72rem] font-semibold uppercase tracking-wide transition ${getStatusClasses(tile.status)} ${isSelected ? 'scale-[0.97] ring-2 ring-white/80' : ''} ${board?.isLocked ? 'cursor-default' : 'cursor-pointer'}`}
                    aria-pressed={isSelected}
                    aria-label={`${tile.label} ${getStatusLabel(tile.status)}`}
                    disabled={pendingAction === tile.tileId}
                  >
                    {tile.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Board Status</h3>
            <div className="mt-4 grid gap-3 text-sm text-slate-700 dark:text-slate-200">
              <div className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-900">
                <span>Checked tiles</span>
                <span className="font-semibold">{checkedTileCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-900">
                <span>Pending reports</span>
                <span className="font-semibold">{pendingTileCount}</span>
              </div>
              <div className="rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-900">
                {board?.isLocked && confirmedTile ? (
                  <p className="font-medium text-emerald-700 dark:text-emerald-300">
                    {confirmedTile.label} is confirmed. The board is locked until reset.
                  </p>
                ) : (
                  <p>Board is open. Pending tiles still need a second distinct confirmation.</p>
                )}
              </div>
              {error ? (
                <p className="rounded-xl bg-rose-50 px-4 py-3 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
                  {error}
                </p>
              ) : null}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Selected Tile</h3>
            {selectedTile ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">Tile</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{selectedTile.label}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Status: {getStatusLabel(selectedTile.status)}
                  </p>
                </div>

                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {selectedTile.pendingReportedByName ? (
                    <p>Reported by {selectedTile.pendingReportedByName}</p>
                  ) : null}
                  {selectedTile.confirmedByName ? (
                    <p>Confirmed by {selectedTile.confirmedByName}</p>
                  ) : null}
                  {!selectedTile.pendingReportedByName && selectedTile.status === 'pending' ? (
                    <p>Reported by an anonymous player</p>
                  ) : null}
                </div>

                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => updateTile(selectedTile.tileId, 'pending')}
                    className="btn bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={Boolean(board?.isLocked) || pendingAction === selectedTile.tileId || selectedTile.status === 'confirmed'}
                  >
                    Mark As Found
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTile(selectedTile.tileId, 'unchecked')}
                    className="btn bg-slate-200 text-slate-900 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                    disabled={Boolean(board?.isLocked) || pendingAction === selectedTile.tileId || selectedTile.status === 'confirmed' || selectedTile.status === 'unchecked'}
                  >
                    Reset Tile
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTile(selectedTile.tileId, 'confirmed')}
                    className="btn bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={Boolean(board?.isLocked) || pendingAction === selectedTile.tileId || !canConfirmSelectedTile}
                  >
                    Second And Confirm
                  </button>
                </div>

                {selectedTile.status === 'pending' && !canConfirmSelectedTile ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    This pending tile must be confirmed by a different browser than the one that reported it.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                Select a tile to mark it checked, report a find, or confirm a pending report.
              </p>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
};

export default FeebasTileChecker;
