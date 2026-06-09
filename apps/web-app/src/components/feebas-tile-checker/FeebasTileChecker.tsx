import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FeebasTileCheckerView } from './FeebasTileCheckerView';
import { useFeebasLiveUpdates } from './useFeebasLiveUpdates';
import {
  DEFAULT_FEEBAS_DISPLAY_MODE_HOTKEY,
  getStoredFeebasDisplayModeHotkey,
  isEditableHotkeyTarget,
  isFeebasDisplayModeHotkeyEvent,
  normalizeFeebasDisplayModeHotkey,
  storeFeebasDisplayModeHotkey,
} from '../../utils/feebasHotkey';
import { getClientLocale, getLocaleParamPath, getTranslations } from '../../i18n';
import { DEFAULT_LOCATION, getLocalizedLocationOptions } from './locations';
import { DEFAULT_LEADERBOARD_SORT } from './leaderboard';
import type {
  AuthResponse, AuthUser, BoardDisplayMode, BoardResponse, FeebasActivityDelta,
  FeebasActivityEntry, FeebasBoard as FeebasBoardType, FeebasTile, FeebasTileCheckerProps,
  PendingNominationNotification, TileStatus,
} from './shared';
import {
  ACTIVE_LOCATION_STORAGE_KEY, ACTIVITY_PAGE_SIZE, CLIENT_ID_STORAGE_KEY, createClientId, formatActorName, formatCopy,
  formatCountdown, getBoardMinWidth, getInitialLocationId, getPendingActivityEntries, getTileLabel, isAuthUser,
  PENDING_NOMINATION_NOTIFICATION_TIMEOUT_MS, RESET_REFRESH_RETRY_MS, resolveLocationId,
} from './shared';

type NotificationLocationSource = Pick<FeebasBoardType, 'location' | 'displayName'>;

const FeebasTileChecker = ({ apiBaseUrl, location, locale }: FeebasTileCheckerProps) => {
  const normalizedApiBaseUrl = useMemo(() => apiBaseUrl.replace(/\/+$/, ''), [apiBaseUrl]);
  const activeLocale = getClientLocale(locale);
  const translations = getTranslations(activeLocale);
  const messages = translations.tools.feebasChecker;
  const authMessages = translations.auth;
  const localizedLocationOptions = useMemo(
    () => getLocalizedLocationOptions(messages.locations),
    [messages.locations]
  );
  const localizedLocationOptionsById = useMemo(
    () => new Map(localizedLocationOptions.map((option) => [option.id, option])),
    [localizedLocationOptions]
  );
  const [activeLocation, setActiveLocation] = useState(() => getInitialLocationId(location));
  const [board, setBoard] = useState<FeebasBoardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<BoardDisplayMode>('voting');
  const [displayModeHotkey, setDisplayModeHotkey] = useState(getStoredFeebasDisplayModeHotkey);
  const [isHotkeyCaptureActive, setIsHotkeyCaptureActive] = useState(false);
  const [hotkeyCaptureError, setHotkeyCaptureError] = useState<string | null>(null);
  const [leaderboardSort, setLeaderboardSort] = useState(DEFAULT_LEADERBOARD_SORT);
  const [activityPage, setActivityPage] = useState(1);
  const [countdown, setCountdown] = useState('--:--');
  const [pendingNominationNotification, setPendingNominationNotification] =
    useState<PendingNominationNotification | null>(null);
  const [notificationStreamLocation, setNotificationStreamLocation] = useState<string | null>(null);
  const lastFetchedCycleEndRef = useRef<string | null>(null);
  const notificationLastFetchedCycleEndRef = useRef<string | null>(null);
  const resetRefreshInFlightRef = useRef(false);
  const notificationResetRefreshInFlightRef = useRef(false);
  const resetRetryTimeoutRef = useRef<number | null>(null);
  const pendingActivityCycleEndByLocationRef = useRef<Map<string, string>>(new Map());
  const seenPendingActivityIdsByLocationRef = useRef<Map<string, Set<number>>>(new Map());
  const activeLocationOption =
    localizedLocationOptionsById.get(activeLocation) || localizedLocationOptionsById.get(DEFAULT_LOCATION)!;
  const activeTerrain = activeLocationOption.terrain;
  const relatedNotificationLocation = activeLocationOption.groupId
    ? localizedLocationOptions.find((option) => option.groupId === activeLocationOption.groupId && option.id !== activeLocation)?.id || null
    : null;
  const activeNotificationStreamLocation =
    notificationStreamLocation === relatedNotificationLocation ? notificationStreamLocation : null;
  const actorFingerprint = authUser ? `account-${authUser.id}` : clientId;
  const voteActorName = authUser?.ign.trim();
  const authHref = getLocaleParamPath('/auth', activeLocale);
  const querySuffix = actorFingerprint ? `?actorFingerprint=${encodeURIComponent(actorFingerprint)}` : '';

  const getNotificationLocationName = useCallback((source: NotificationLocationSource) => {
    const locationOption = localizedLocationOptionsById.get(source.location);
    if (!locationOption) return source.displayName;
    if (locationOption.areaLabel) return `${locationOption.displayName} (${locationOption.areaLabel})`;
    return locationOption.displayName;
  }, [localizedLocationOptionsById]);

  const showPendingNominationNotification = useCallback((
    source: NotificationLocationSource,
    activity: FeebasActivityEntry,
    isSelfNomination: boolean
  ) => {
    const actorName = formatActorName(activity.actorName, messages.general.anonymousName);

    setPendingNominationNotification({
      title: isSelfNomination
        ? messages.notifications.pendingNominationSelfTitle
        : messages.notifications.pendingNominationTitle,
      message: formatCopy(
        isSelfNomination
          ? messages.notifications.pendingNominationSelfBody
          : messages.notifications.pendingNominationBody,
        {
          actorName,
          location: getNotificationLocationName(source),
          tileLabel: activity.tileLabel,
        }
      ),
      isSelfNomination,
    });
  }, [getNotificationLocationName, messages]);

  const syncPendingNominationNotifications = useCallback((nextBoard: FeebasBoardType) => {
    const pendingActivities = getPendingActivityEntries(nextBoard);
    const pendingActivityIds = new Set(pendingActivities.map((entry) => entry.id));
    const previousCycleEnd = pendingActivityCycleEndByLocationRef.current.get(nextBoard.location);

    if (previousCycleEnd !== nextBoard.cycleEnd) {
      if (previousCycleEnd && previousCycleEnd !== nextBoard.cycleEnd) {
        setPendingNominationNotification(null);
      }

      pendingActivityCycleEndByLocationRef.current.set(nextBoard.location, nextBoard.cycleEnd);
      seenPendingActivityIdsByLocationRef.current.set(nextBoard.location, pendingActivityIds);
      return;
    }

    const seenPendingActivityIds = seenPendingActivityIdsByLocationRef.current.get(nextBoard.location) || new Set<number>();
    const newPendingActivities = pendingActivities.filter((entry) => !seenPendingActivityIds.has(entry.id));
    seenPendingActivityIdsByLocationRef.current.set(nextBoard.location, new Set([
      ...Array.from(seenPendingActivityIds),
      ...Array.from(pendingActivityIds),
    ]));

    const latestPendingActivity = newPendingActivities.sort((left, right) => right.id - left.id)[0];
    if (!latestPendingActivity) return;

    const pendingTile = nextBoard.tiles.find((tile) => tile.tileId === latestPendingActivity.tileId);
    const isCurrentSessionNomination = pendingTile?.currentUserVote === 'pending';
    showPendingNominationNotification(nextBoard, latestPendingActivity, isCurrentSessionNomination);
  }, [showPendingNominationNotification]);

  const syncPendingNominationActivityDelta = useCallback((activityDelta: FeebasActivityDelta) => {
    if (!activityDelta.location || !activityDelta.cycleEnd) return;

    const pendingActivities = activityDelta.activity.filter((entry) => (
      entry.actionType !== 'cleared_vote' && entry.nextStatus === 'pending'
    ));
    if (pendingActivities.length === 0) return;

    const previousCycleEnd = pendingActivityCycleEndByLocationRef.current.get(activityDelta.location);
    if (previousCycleEnd !== activityDelta.cycleEnd) {
      if (previousCycleEnd && previousCycleEnd !== activityDelta.cycleEnd) {
        setPendingNominationNotification(null);
      }

      pendingActivityCycleEndByLocationRef.current.set(activityDelta.location, activityDelta.cycleEnd);
      seenPendingActivityIdsByLocationRef.current.set(activityDelta.location, new Set<number>());
    }

    const seenPendingActivityIds =
      seenPendingActivityIdsByLocationRef.current.get(activityDelta.location) || new Set<number>();
    const newPendingActivities = pendingActivities.filter((entry) => !seenPendingActivityIds.has(entry.id));

    seenPendingActivityIdsByLocationRef.current.set(activityDelta.location, new Set([
      ...Array.from(seenPendingActivityIds),
      ...pendingActivities.map((entry) => entry.id),
    ]));

    const latestPendingActivity = newPendingActivities.sort((left, right) => right.id - left.id)[0];
    if (!latestPendingActivity) return;

    showPendingNominationNotification(activityDelta, latestPendingActivity, Boolean(activityDelta.isSelfNomination));
  }, [showPendingNominationNotification]);

  const applyBoardUpdate = useCallback((nextBoard: FeebasBoardType) => {
    syncPendingNominationNotifications(nextBoard);
    setBoard((currentBoard) => ({
      ...nextBoard,
      leaderboard: nextBoard.leaderboard
        || (currentBoard?.location === nextBoard.location ? currentBoard.leaderboard : undefined),
    }));
  }, [syncPendingNominationNotifications]);

  const applyNotificationBoardUpdate = useCallback((nextBoard: FeebasBoardType) => {
    syncPendingNominationNotifications(nextBoard);
  }, [syncPendingNominationNotifications]);

  const applyActivityDeltaToBoard = useCallback((activityDelta: FeebasActivityDelta) => {
    syncPendingNominationActivityDelta(activityDelta);

    setBoard((currentBoard) => {
      if (
        !currentBoard
        || currentBoard.location !== activityDelta.location
        || currentBoard.cycleEnd !== activityDelta.cycleEnd
      ) {
        return currentBoard;
      }

      const existingActivityIds = new Set(currentBoard.activity.map((entry) => entry.id));
      const newActivityEntries = activityDelta.activity.filter((entry) => !existingActivityIds.has(entry.id));
      if (newActivityEntries.length === 0) {
        return currentBoard;
      }

      return {
        ...currentBoard,
        activity: [
          ...newActivityEntries,
          ...currentBoard.activity,
        ],
      };
    });
  }, [syncPendingNominationActivityDelta]);

  const fetchBoard = useCallback(async () => {
    if (!actorFingerprint) return;

    const response = await fetch(`${normalizedApiBaseUrl}/feebas/${activeLocation}${querySuffix}`, {
      credentials: 'include',
    });
    const payload: BoardResponse = await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(payload.message || messages.errors.loadBoard);
    }

    applyBoardUpdate(payload.data);
    setCountdown(formatCountdown(payload.data.cycleEnd));
    lastFetchedCycleEndRef.current = payload.data.cycleEnd;
  }, [activeLocation, actorFingerprint, applyBoardUpdate, messages.errors.loadBoard, normalizedApiBaseUrl, querySuffix]);

  const saveDisplayModeHotkey = (nextHotkey: string) => {
    setDisplayModeHotkey(nextHotkey);
    storeFeebasDisplayModeHotkey(nextHotkey);
  };

  const startHotkeyCapture = () => {
    setIsHotkeyCaptureActive(true);
    setHotkeyCaptureError(null);
  };

  const resetDisplayModeHotkey = () => {
    saveDisplayModeHotkey(DEFAULT_FEEBAS_DISPLAY_MODE_HOTKEY);
    setIsHotkeyCaptureActive(false);
    setHotkeyCaptureError(null);
  };

  const clearResetRetryTimeout = useCallback(() => {
    if (resetRetryTimeoutRef.current !== null) {
      window.clearTimeout(resetRetryTimeoutRef.current);
      resetRetryTimeoutRef.current = null;
    }
  }, []);
  const clearNotificationResetRetryTimeout = useCallback(() => {}, []);
  const ignoreCountdownUpdate = useCallback<React.Dispatch<React.SetStateAction<string>>>(() => undefined, []);
  const ignoreLiveUpdateError = useCallback<React.Dispatch<React.SetStateAction<string | null>>>(() => undefined, []);

  const refreshBoardAfterReset = useCallback(async (expiredCycleEnd: string) => {
    resetRefreshInFlightRef.current = true;

    try {
      await fetchBoard();
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : messages.errors.refreshBoard);
    } finally {
      resetRefreshInFlightRef.current = false;
    }

    if (lastFetchedCycleEndRef.current !== expiredCycleEnd) {
      clearResetRetryTimeout();
      return;
    }

    resetRetryTimeoutRef.current = window.setTimeout(() => {
      resetRetryTimeoutRef.current = null;

      if (lastFetchedCycleEndRef.current === expiredCycleEnd) {
        void refreshBoardAfterReset(expiredCycleEnd);
      }
    }, RESET_REFRESH_RETRY_MS);
  }, [clearResetRetryTimeout, fetchBoard, messages.errors.refreshBoard]);

  useEffect(() => {
    try {
      const storedClientId = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
      const resolvedClientId = storedClientId || createClientId();
      localStorage.setItem(CLIENT_ID_STORAGE_KEY, resolvedClientId);
      setClientId(resolvedClientId);
    } catch {
      setClientId(createClientId());
    }
  }, []);

  useEffect(() => {
    const handleAuthUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<AuthUser | null>;
      const nextUser = customEvent.detail;

      setAuthUser(isAuthUser(nextUser) ? nextUser : null);
      setIsAuthLoading(false);
    };

    window.addEventListener('team-soju-auth-updated', handleAuthUpdated);

    return () => {
      window.removeEventListener('team-soju-auth-updated', handleAuthUpdated);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadAuthUser() {
      setIsAuthLoading(true);

      try {
        const response = await fetch(`${normalizedApiBaseUrl}/auth/me`, {
          credentials: 'include',
        });
        const body = await response.json() as AuthResponse;
        const nextUser = body.data;

        if (mounted && response.ok && body.success && isAuthUser(nextUser)) {
          setAuthUser(nextUser);
        } else if (mounted) {
          setAuthUser(null);
        }
      } catch {
        if (mounted) setAuthUser(null);
      } finally {
        if (mounted) setIsAuthLoading(false);
      }
    }

    loadAuthUser();

    return () => {
      mounted = false;
    };
  }, [normalizedApiBaseUrl]);

  useEffect(() => {
    if (location) setActiveLocation(resolveLocationId(location));
  }, [location]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_LOCATION_STORAGE_KEY, activeLocation);
    } catch {
      // Ignore storage write failures.
    }
  }, [activeLocation]);

  useEffect(() => {
    const handleDisplayModeHotkey = (event: KeyboardEvent) => {
      if (isHotkeyCaptureActive) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setIsHotkeyCaptureActive(false);
          setHotkeyCaptureError(null);
          return;
        }

        if (!isFeebasDisplayModeHotkeyEvent(event)) {
          event.preventDefault();
          setHotkeyCaptureError(messages.heatmap.invalidShortcut);
          return;
        }

        const nextHotkey = normalizeFeebasDisplayModeHotkey(event.key);

        if (nextHotkey) {
          event.preventDefault();
          saveDisplayModeHotkey(nextHotkey);
          setIsHotkeyCaptureActive(false);
          setHotkeyCaptureError(null);
        }

        return;
      }

      if (!isFeebasDisplayModeHotkeyEvent(event) || isEditableHotkeyTarget(event.target)) return;
      if (normalizeFeebasDisplayModeHotkey(event.key) !== displayModeHotkey) return;

      setDisplayMode((currentMode) => (currentMode === 'voting' ? 'heatmap' : 'voting'));
    };

    window.addEventListener('keydown', handleDisplayModeHotkey);

    return () => {
      window.removeEventListener('keydown', handleDisplayModeHotkey);
    };
  }, [displayModeHotkey, isHotkeyCaptureActive, messages.heatmap.invalidShortcut]);

  useEffect(() => {
    if (!actorFingerprint || isAuthLoading) return undefined;

    let mounted = true;

    (async () => {
      try {
        clearResetRetryTimeout();
        resetRefreshInFlightRef.current = false;
        setLoading(true);
        setError(null);
        setBoard(null);
        setPendingNominationNotification(null);
        setSelectedTileId(null);
        setActivityPage(1);
        await fetchBoard();
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : messages.errors.loadBoard);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      clearResetRetryTimeout();
      resetRefreshInFlightRef.current = false;
    };
  }, [actorFingerprint, clearResetRetryTimeout, fetchBoard, isAuthLoading, messages.errors.loadBoard]);

  useEffect(() => {
    setNotificationStreamLocation(null);

    if (!relatedNotificationLocation || !actorFingerprint || isAuthLoading) {
      return undefined;
    }

    let mounted = true;

    (async () => {
      try {
        const response = await fetch(`${normalizedApiBaseUrl}/feebas/${relatedNotificationLocation}${querySuffix}`, {
          credentials: 'include',
        });
        const payload: BoardResponse = await response.json();

        if (mounted && response.ok && payload.success) {
          syncPendingNominationNotifications(payload.data);
        }
      } catch {
        // The sibling live stream can still connect; this seed separates existing pending activity from new updates.
      } finally {
        if (mounted) {
          setNotificationStreamLocation(relatedNotificationLocation);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    actorFingerprint,
    isAuthLoading,
    normalizedApiBaseUrl,
    querySuffix,
    relatedNotificationLocation,
    syncPendingNominationNotifications,
  ]);

  useFeebasLiveUpdates({
    activeLocation,
    actorFingerprint,
    isAuthLoading,
    liveUpdatesDisconnectedMessage: messages.errors.liveUpdatesDisconnected,
    normalizedApiBaseUrl,
    lastFetchedCycleEndRef,
    resetRefreshInFlightRef,
    applyBoardUpdate,
    applyActivityDelta: applyActivityDeltaToBoard,
    clearResetRetryTimeout,
    setCountdown,
    setError,
  });

  useFeebasLiveUpdates({
    activeLocation: activeNotificationStreamLocation,
    actorFingerprint,
    isAuthLoading,
    liveUpdatesDisconnectedMessage: messages.errors.liveUpdatesDisconnected,
    normalizedApiBaseUrl,
    lastFetchedCycleEndRef: notificationLastFetchedCycleEndRef,
    resetRefreshInFlightRef: notificationResetRefreshInFlightRef,
    applyBoardUpdate: applyNotificationBoardUpdate,
    applyActivityDelta: syncPendingNominationActivityDelta,
    clearResetRetryTimeout: clearNotificationResetRetryTimeout,
    setCountdown: ignoreCountdownUpdate,
    setError: ignoreLiveUpdateError,
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(formatCountdown(lastFetchedCycleEndRef.current));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!pendingNominationNotification?.isSelfNomination) return undefined;

    const timer = window.setTimeout(() => {
      setPendingNominationNotification(null);
    }, PENDING_NOMINATION_NOTIFICATION_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pendingNominationNotification]);

  useEffect(() => {
    const expiredCycleEnd = lastFetchedCycleEndRef.current;

    if (
      !expiredCycleEnd
      || countdown !== '00:00'
      || resetRefreshInFlightRef.current
      || resetRetryTimeoutRef.current !== null
    ) {
      return;
    }

    void refreshBoardAfterReset(expiredCycleEnd);
  }, [countdown, refreshBoardAfterReset]);

  useEffect(() => () => {
    clearResetRetryTimeout();
  }, [clearResetRetryTimeout]);

  const tileMap = useMemo(() => {
    if (!board) return new Map<string, FeebasTile>();
    return new Map(board.tiles.map((tile) => [tile.tileId, tile]));
  }, [board]);

  const tileByPosition = useMemo(() => {
    if (!board) return new Map<string, FeebasTile>();
    return new Map(board.tiles.map((tile) => [`${tile.row}-${tile.col}`, tile]));
  }, [board]);

  const previousConfirmedTileCounts = useMemo(() => {
    if (!board) return new Map<string, number>();
    return new Map((board.previousConfirmedTiles || []).map((tile) => [tile.tileId, tile.confirmations]));
  }, [board]);

  const maxPreviousConfirmations = useMemo(() => {
    const previousConfirmedTiles = board?.previousConfirmedTiles || [];
    if (!previousConfirmedTiles.length) return 0;
    return Math.max(...previousConfirmedTiles.map((tile) => tile.confirmations));
  }, [board]);

  const selectedTile = selectedTileId ? tileMap.get(selectedTileId) || null : null;
  const totalCheckedVotes = board?.tiles.reduce((sum, tile) => sum + tile.voteCounts.checked, 0) || 0;
  const totalPendingVotes = board?.tiles.reduce((sum, tile) => sum + tile.voteCounts.pending, 0) || 0;
  const totalConfirmedVotes = board?.tiles.reduce((sum, tile) => sum + tile.voteCounts.confirmed, 0) || 0;
  const activityEntries = board?.activity || [];
  const activityPageCount = Math.max(1, Math.ceil(activityEntries.length / ACTIVITY_PAGE_SIZE));
  const activityCurrentPage = Math.min(activityPage, activityPageCount);
  const activityStartIndex = (activityCurrentPage - 1) * ACTIVITY_PAGE_SIZE;
  const paginatedActivityEntries = activityEntries.slice(activityStartIndex, activityStartIndex + ACTIVITY_PAGE_SIZE);
  const leaderboardEntries = board?.leaderboard?.entries || [];
  const selectedTileLabel = selectedTile ? getTileLabel(selectedTile.row, selectedTile.col, board?.layout.rows || activeTerrain.length) : null;
  const layoutRows = board?.layout.rows || activeTerrain.length;
  const layoutCols = board?.layout.cols || activeTerrain[0]?.length || 1;
  const boardMinWidth = getBoardMinWidth(layoutCols);
  const isHeatmapMode = displayMode === 'heatmap';

  useEffect(() => {
    if (activityPage > activityPageCount) setActivityPage(activityPageCount);
  }, [activityPage, activityPageCount]);

  const updateTile = async (tileId: string, status: TileStatus) => {
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
  };

  const handleTilePress = (tile: FeebasTile) => {
    if (isHeatmapMode) return;

    setSelectedTileId(tile.tileId);

    if (pendingAction || tile.currentUserVote !== 'unchecked' || tile.voteCounts.pending > 0 || tile.voteCounts.confirmed > 0) {
      return;
    }

    void updateTile(tile.tileId, 'checked');
  };

  return (
    <FeebasTileCheckerView
      activeLocale={activeLocale}
      activeLocation={activeLocation}
      activeLocationOption={activeLocationOption}
      activeTerrain={activeTerrain}
      activityCurrentPage={activityCurrentPage}
      activityEntries={activityEntries}
      activityPageCount={activityPageCount}
      authHref={authHref}
      authMessages={authMessages}
      authUser={authUser}
      board={board}
      boardMinWidth={boardMinWidth}
      countdown={countdown}
      displayMode={displayMode}
      displayModeHotkey={displayModeHotkey}
      error={error}
      hotkeyCaptureError={hotkeyCaptureError}
      isAuthLoading={isAuthLoading}
      isHeatmapMode={isHeatmapMode}
      isHotkeyCaptureActive={isHotkeyCaptureActive}
      layoutCols={layoutCols}
      layoutRows={layoutRows}
      leaderboardEntries={leaderboardEntries}
      leaderboardSort={leaderboardSort}
      loading={loading}
      locationOptions={localizedLocationOptions}
      maxPreviousConfirmations={maxPreviousConfirmations}
      messages={messages}
      paginatedActivityEntries={paginatedActivityEntries}
      pendingAction={pendingAction}
      pendingNominationNotification={pendingNominationNotification}
      previousConfirmedTileCounts={previousConfirmedTileCounts}
      selectedTile={selectedTile}
      selectedTileId={selectedTileId}
      selectedTileLabel={selectedTileLabel}
      tileByPosition={tileByPosition}
      totalCheckedVotes={totalCheckedVotes}
      totalConfirmedVotes={totalConfirmedVotes}
      totalPendingVotes={totalPendingVotes}
      onActivityPageChange={setActivityPage}
      onDismissPendingNomination={() => setPendingNominationNotification(null)}
      onDisplayModeChange={setDisplayMode}
      onLeaderboardSortChange={setLeaderboardSort}
      onLocationChange={setActiveLocation}
      onResetHotkey={resetDisplayModeHotkey}
      onStartHotkeyCapture={startHotkeyCapture}
      onTilePress={handleTilePress}
      onUpdateTile={updateTile}
    />
  );
};

export default FeebasTileChecker;
