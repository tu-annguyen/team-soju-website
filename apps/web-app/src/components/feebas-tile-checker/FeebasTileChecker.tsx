import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchFeebasBoardData } from './feebasBoardData';
import { mergeFeebasBoardUpdate } from './feebasBoardMerge';
import { FeebasTileCheckerView } from './FeebasTileCheckerView';
import { useFeebasDisplayModeState } from './useFeebasDisplayModeState';
import { useFeebasIdentity } from './useFeebasIdentity';
import { useFeebasLiveUpdates } from './useFeebasLiveUpdates';
import { useStoredFeebasLocation } from './useStoredFeebasLocation';
import { useVisiblePolling } from './useVisiblePolling';
import { getClientLocale, getLocaleParamPath, getTranslations } from '../../i18n';
import { DEFAULT_LOCATION, getLocalizedLocationOptions } from './locations';
import { DEFAULT_LEADERBOARD_SORT } from './leaderboard';
import type {
  BoardResponse, FeebasActivityDelta,
  FeebasActivityEntry, FeebasBoard as FeebasBoardType, FeebasTile, FeebasTileCheckerProps, FeebasTileDelta,
  PendingNominationNotification, TileStatus,
} from './shared';
import {
  ACTIVITY_PAGE_SIZE, formatActorName, formatCopy,
  FEEBAS_BOARD_POLL_INTERVAL_MS, formatCountdown, getBoardMinWidth, getPendingActivityEntries, getTileLabel,
  PENDING_NOMINATION_NOTIFICATION_TIMEOUT_MS, RESET_REFRESH_RETRY_MS,
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
  const { activeLocation, setActiveLocation } = useStoredFeebasLocation(location);
  const [board, setBoard] = useState<FeebasBoardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [leaderboardSort, setLeaderboardSort] = useState(DEFAULT_LEADERBOARD_SORT);
  const [activityPage, setActivityPage] = useState(1);
  const [countdown, setCountdown] = useState('--:--');
  const [pendingNominationNotification, setPendingNominationNotification] =
    useState<PendingNominationNotification | null>(null);
  const [notificationStreamLocation, setNotificationStreamLocation] = useState<string | null>(null);
  const { authUser, clientId, isAuthLoading } = useFeebasIdentity(normalizedApiBaseUrl);
  const {
    displayMode,
    displayModeHotkey,
    hotkeyCaptureError,
    isHotkeyCaptureActive,
    resetDisplayModeHotkey,
    setDisplayMode,
    startHotkeyCapture,
  } = useFeebasDisplayModeState(messages);
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
    setBoard((currentBoard) => mergeFeebasBoardUpdate(currentBoard, nextBoard));
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

  const applyTileDeltaToBoard = useCallback((tileDelta: FeebasTileDelta) => {
    syncPendingNominationActivityDelta(tileDelta);

    setBoard((currentBoard) => {
      if (
        !currentBoard
        || currentBoard.location !== tileDelta.location
        || currentBoard.cycleEnd !== tileDelta.cycleEnd
      ) {
        return currentBoard;
      }

      const existingActivityIds = new Set(currentBoard.activity.map((entry) => entry.id));
      const newActivityEntries = tileDelta.activity.filter((entry) => !existingActivityIds.has(entry.id));
      const tileUpdatesById = new Map(tileDelta.tiles.map((tile) => [tile.tileId, tile]));

      return {
        ...currentBoard,
        serverTime: tileDelta.serverTime || currentBoard.serverTime,
        activity: newActivityEntries.length > 0
          ? [...newActivityEntries, ...currentBoard.activity]
          : currentBoard.activity,
        tiles: currentBoard.tiles.map((tile) => {
          const tileUpdate = tileUpdatesById.get(tile.tileId);
          if (!tileUpdate) return tile;

          return {
            ...tile,
            status: tileUpdate.status,
            voteCounts: tileUpdate.voteCounts,
            totalVotes: tileUpdate.totalVotes,
          };
        }),
      };
    });
  }, [syncPendingNominationActivityDelta]);

  const fetchBoard = useCallback(async () => {
    if (!actorFingerprint) return;

    const nextBoard = await fetchFeebasBoardData({
      activeLocation,
      actorFingerprint,
      loadBoardMessage: messages.errors.loadBoard,
      normalizedApiBaseUrl,
    });

    applyBoardUpdate(nextBoard);
    setCountdown(formatCountdown(nextBoard.cycleEnd));
    lastFetchedCycleEndRef.current = nextBoard.cycleEnd;
  }, [activeLocation, actorFingerprint, applyBoardUpdate, messages.errors.loadBoard, normalizedApiBaseUrl]);

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

  const refreshBoardSilently = useCallback(() => {
    void fetchBoard().catch((nextError) => {
      setError(nextError instanceof Error ? nextError.message : messages.errors.refreshBoard);
    });
  }, [fetchBoard, messages.errors.refreshBoard]);

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
    applyTileDelta: applyTileDeltaToBoard,
    clearResetRetryTimeout,
    onResume: refreshBoardSilently,
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
    applyTileDelta: syncPendingNominationActivityDelta,
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

  useVisiblePolling({
    enabled: Boolean(actorFingerprint && !isAuthLoading && board),
    intervalMs: FEEBAS_BOARD_POLL_INTERVAL_MS,
    onPoll: refreshBoardSilently,
  });

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
