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

type FeebasActivityEntry = {
  id: number;
  tileId: string;
  tileLabel: string;
  actionType: string;
  previousStatus: string | null;
  nextStatus: TileStatus;
  actorName: string | null;
  createdAt: string;
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
  activity: FeebasActivityEntry[];
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
const ROUTE_119_MAIN_TERRAIN = [
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'rock', 'rock', 'water', 'water', 'rock', 'rock', 'water', 'water', 'rock', 'rock', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'rock', 'rock', 'water', 'water', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'bank', 'bank', 'bank', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['grass', 'grass', 'grass', 'grass', 'bank', 'bank', 'bank', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'water'],
  ['rock', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['rock', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass'],
  ['rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['rock', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
] as const;

function getStatusClasses(status: TileStatus) {
  return ({
    unchecked: 'bg-slate-500/90 hover:bg-slate-400 text-white',
    checked: 'bg-rose-600/95 hover:bg-rose-500 text-white',
    pending: 'bg-amber-400/95 hover:bg-amber-300 text-slate-950',
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

function getTerrainClasses(terrain: string) {
  return ({
    grass: 'bg-[linear-gradient(180deg,_#c4e2ab_0%,_#8fbd72_100%)]',
    bank: 'bg-[linear-gradient(180deg,_#f0dfaa_0%,_#cfb479_100%)]',
    water: 'bg-[linear-gradient(180deg,_#496dd1_0%,_#2d488f_100%)]',
    rock: 'bg-[linear-gradient(180deg,_#62666f_0%,_#3b3f48_100%)]',
  }[terrain] || 'bg-transparent');
}

function getActivityMessage(actionType: string) {
  return ({
    checked: 'marked checked',
    unchecked: 'returned to unchecked',
    reported: 'reported as a Feebas tile',
    cleared_pending: 'cleared the pending report on',
    reverted_to_checked: 'moved back to checked',
    confirmed: 'confirmed as the Feebas tile',
    updated: 'updated',
  }[actionType] || 'updated');
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

function formatActorName(actorName: string | null) {
  return actorName?.trim() || 'Anonymous';
}

function formatTimestamp(isoTimestamp: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoTimestamp));
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

  const tileByPosition = useMemo(() => {
    if (!board) {
      return new Map<string, FeebasTile>();
    }

    return new Map(board.tiles.map((tile) => [`${tile.row}-${tile.col}`, tile]));
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

          <div className="overflow-x-auto bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.35),_transparent_30%),linear-gradient(180deg,_#d6f2f4_0%,_#8fd4e8_45%,_#4d8bc6_100%)] p-4">
            <div
              className="mx-auto grid max-w-3xl gap-1 rounded-2xl border border-sky-100/50 bg-sky-950/10 p-2 shadow-[0_18px_45px_rgba(20,55,107,0.24)] backdrop-blur-sm"
              style={{
                gridTemplateColumns: `repeat(${board?.layout.cols || 1}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: (board?.layout.rows || 0) * (board?.layout.cols || 0) }, (_, index) => {
                const cols = board?.layout.cols || 1;
                const row = Math.floor(index / cols);
                const col = index % cols;
                const tile = tileByPosition.get(`${row}-${col}`) || null;
                const terrain = ROUTE_119_MAIN_TERRAIN[row]?.[col] || 'bank';
                const terrainClasses = getTerrainClasses(terrain);

                if (!tile) {
                  return (
                    <div
                      key={`void-${row}-${col}`}
                      className={`aspect-square rounded-[0.35rem] border border-black/5 ${terrainClasses}`}
                    />
                  );
                }

                const isSelected = selectedTileId === tile.tileId;
                const pendingName = tile.status === 'pending' ? formatActorName(tile.pendingReportedByName) : null;

                return (
                  <div
                    key={tile.tileId}
                    className={`relative aspect-square rounded-[0.35rem] border border-white/10 ${terrainClasses}`}
                  >
                    <div className="absolute inset-[8%] rounded-[0.3rem] bg-[linear-gradient(180deg,_rgba(255,255,255,0.18),_rgba(255,255,255,0.03))]" />
                    <button
                      type="button"
                      onClick={() => handleTilePress(tile)}
                      className={`relative z-10 flex h-full w-full flex-col items-center justify-center rounded-[0.35rem] border border-white/20 px-1 text-[0.68rem] font-semibold uppercase tracking-wide transition ${getStatusClasses(tile.status)} ${isSelected ? 'scale-[0.97] ring-2 ring-white/80' : ''} ${board?.isLocked ? 'cursor-default' : 'cursor-pointer'}`}
                      aria-pressed={isSelected}
                      aria-label={`${tile.label} ${getStatusLabel(tile.status)}`}
                      disabled={Boolean(board?.isLocked) || pendingAction === tile.tileId}
                    >
                      <span>{tile.label}</span>
                      {pendingName ? (
                        <span className="mt-1 max-w-full truncate rounded bg-black/20 px-1.5 py-0.5 text-[0.54rem] normal-case tracking-normal text-slate-950">
                          {pendingName}
                        </span>
                      ) : null}
                    </button>
                  </div>
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
                  {!selectedTile.pendingReportedByName && selectedTile.status === 'pending' ? (
                    <p>Reported by an anonymous player</p>
                  ) : null}
                  {selectedTile.confirmedByName ? (
                    <p>Confirmed by {selectedTile.confirmedByName}</p>
                  ) : null}
                </div>

                {board?.isLocked ? (
                  <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    This cycle is locked. Tiles stay read-only until the next reset.
                  </p>
                ) : (
                  <div className="grid gap-3">
                    <button
                      type="button"
                      onClick={() => updateTile(selectedTile.tileId, 'pending')}
                      className="btn bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={pendingAction === selectedTile.tileId || selectedTile.status === 'confirmed'}
                    >
                      Mark As Found
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTile(selectedTile.tileId, 'unchecked')}
                      className="btn bg-slate-200 text-slate-900 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                      disabled={pendingAction === selectedTile.tileId || selectedTile.status === 'confirmed' || selectedTile.status === 'unchecked'}
                    >
                      Reset Tile
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTile(selectedTile.tileId, 'confirmed')}
                      className="btn bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={pendingAction === selectedTile.tileId || !canConfirmSelectedTile}
                    >
                      Second And Confirm
                    </button>
                  </div>
                )}

                {selectedTile.status === 'pending' && !canConfirmSelectedTile && !board?.isLocked ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    This pending tile must be confirmed by a different browser than the one that reported it.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                {board?.isLocked
                  ? 'The board is locked for this cycle. Check the confirmed tile and activity feed until reset.'
                  : 'Select a tile to mark it checked, report a find, or confirm a pending report.'}
              </p>
            )}
          </div>

          <div className="card p-5">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Activity</h3>
            {board?.activity.length ? (
              <div className="mt-4 space-y-3">
                {board.activity.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/70"
                  >
                    <p className="text-slate-800 dark:text-slate-100">
                      <span className="font-semibold">{formatActorName(entry.actorName)}</span>{' '}
                      {getActivityMessage(entry.actionType)}{' '}
                      <span className="font-semibold">{entry.tileLabel}</span>.
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {formatTimestamp(entry.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                Tile updates will appear here as players check, report, and confirm the board.
              </p>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
};

export default FeebasTileChecker;
