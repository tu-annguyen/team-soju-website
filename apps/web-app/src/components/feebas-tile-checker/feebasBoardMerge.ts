import type { FeebasActivityEntry, FeebasBoard, FeebasTile } from './shared';

function getActivityId(activity: FeebasActivityEntry | undefined) {
  const id = Number(activity?.id);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

function mergeActivity(currentActivity: FeebasActivityEntry[], nextActivity: FeebasActivityEntry[]) {
  const activityById = new Map<number, FeebasActivityEntry>();

  [...nextActivity, ...currentActivity].forEach((activity) => {
    const id = getActivityId(activity);
    if (id > 0 && !activityById.has(id)) {
      activityById.set(id, activity);
    }
  });

  return Array.from(activityById.values()).sort((left, right) => getActivityId(right) - getActivityId(left));
}

function getLatestActivityByTile(activity: FeebasActivityEntry[]) {
  return activity.reduce<Map<string, number>>((latestByTile, entry) => {
    const id = getActivityId(entry);
    if (!entry.tileId || id <= 0 || id <= (latestByTile.get(entry.tileId) || 0)) {
      return latestByTile;
    }

    latestByTile.set(entry.tileId, id);
    return latestByTile;
  }, new Map());
}

function mergeTiles(currentBoard: FeebasBoard, nextBoard: FeebasBoard) {
  const incomingLatestActivityId = Math.max(0, ...nextBoard.activity.map(getActivityId));
  const currentLatestByTile = getLatestActivityByTile(currentBoard.activity);
  const currentTilesById = new Map(currentBoard.tiles.map((tile) => [tile.tileId, tile]));

  return nextBoard.tiles.map((nextTile) => {
    const currentTile = currentTilesById.get(nextTile.tileId);
    const currentTileLatestActivityId = currentLatestByTile.get(nextTile.tileId) || 0;

    if (currentTile && currentTileLatestActivityId > incomingLatestActivityId) {
      return currentTile;
    }

    return nextTile;
  });
}

export function mergeFeebasBoardUpdate(
  currentBoard: FeebasBoard | null,
  nextBoard: FeebasBoard
): FeebasBoard {
  if (
    !currentBoard
    || currentBoard.location !== nextBoard.location
    || currentBoard.cycleEnd !== nextBoard.cycleEnd
  ) {
    return nextBoard;
  }

  const mergedActivity = mergeActivity(currentBoard.activity, nextBoard.activity);
  const mergedTiles = mergeTiles(currentBoard, nextBoard);

  return {
    ...nextBoard,
    activity: mergedActivity,
    leaderboard: nextBoard.leaderboard || currentBoard.leaderboard,
    tiles: mergedTiles.map((tile): FeebasTile => ({
      ...tile,
      currentUserVote: tile.currentUserVote || 'unchecked',
    })),
  };
}
