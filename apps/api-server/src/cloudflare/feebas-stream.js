const {
  createRepositories,
  createWebSocketPair,
  createWebSocketUpgradeResponse,
  deserializeFeebasSocketMetadata,
  encodeFeebasSocketMessage,
  FeebasRuleError,
  feebasActorFingerprintSchema,
  feebasLastActivityIdSchema,
  getLocationConfig,
  isWebSocketUpgrade,
  json,
  sendFeebasSocketBoard,
  serializeFeebasSocketMetadata,
  webSocketUpgradeRequired,
} = require('./services/worker-support');

function hasFeebasActivityDelta(activityDelta) {
  return Boolean(
    activityDelta?.data
    && Array.isArray(activityDelta.data.activity)
    && activityDelta.data.activity.length > 0
  );
}

function sendFeebasSocketActivityDelta(socket, activityDelta, actorFingerprint) {
  socket.send(encodeFeebasSocketMessage({
    success: true,
    type: 'activity_delta',
    data: {
      ...activityDelta.data,
      isSelfNomination: Boolean(
        activityDelta.actorFingerprint
        && actorFingerprint
        && activityDelta.actorFingerprint === actorFingerprint
      ),
    },
  }));
}

function hasFeebasTileDelta(tileDelta) {
  return Boolean(
    tileDelta?.data
    && Array.isArray(tileDelta.data.tiles)
    && tileDelta.data.tiles.length > 0
  );
}

function sendFeebasSocketTileDelta(socket, tileDelta, actorFingerprint) {
  socket.send(encodeFeebasSocketMessage({
    success: true,
    type: 'tile_delta',
    data: {
      ...tileDelta.data,
      isSelfNomination: Boolean(
        tileDelta.actorFingerprint
        && actorFingerprint
        && tileDelta.actorFingerprint === actorFingerprint
      ),
    },
  }));
}

function getLatestFeebasActivityId(activityDelta) {
  return (activityDelta?.data?.activity || []).reduce((latestActivityId, activity) => {
    const activityId = Number(activity?.id);
    if (!Number.isInteger(activityId) || activityId <= 0) {
      return latestActivityId;
    }

    return Math.max(latestActivityId || 0, activityId);
  }, null);
}

function rememberFeebasSocketActivityId(socket, metadata, activityDelta) {
  const activityId = getLatestFeebasActivityId(activityDelta);
  if (!activityId || activityId <= (metadata.lastActivityId || 0)) {
    return metadata;
  }

  const nextMetadata = {
    ...metadata,
    lastActivityId: activityId,
  };
  serializeFeebasSocketMetadata(socket, nextMetadata);
  return nextMetadata;
}

class FeebasBoardStreamDurableObject {
  constructor(state, env, options = {}) {
    this.state = state;
    this.env = env;
    this.createRepositories = options.createRepositories || createRepositories;
    this.boardCacheByLocation = new Map(); // location -> { board, expiresAt, needsRefresh, refreshPromise }
    this.BOARD_CACHE_TTL_MS = 3000; // 3 second cache to reduce DB queries during concurrent broadcasts
  }

  startBoardCacheRefresh(location, repositories, cacheEntry) {
    cacheEntry.needsRefresh = false;
    cacheEntry.refreshPromise = (async () => {
      if (typeof repositories.feebas.getBoardCache !== 'function') {
        return null;
      }

      const nextBoardCache = await repositories.feebas.getBoardCache(location);
      cacheEntry.board = nextBoardCache;
      cacheEntry.expiresAt = Date.now() + this.BOARD_CACHE_TTL_MS;
      return nextBoardCache;
    })();

    const cleanUpRefresh = () => {
      if (this.boardCacheByLocation.get(location) === cacheEntry) {
        cacheEntry.refreshPromise = null;
        if (!cacheEntry.board) {
          this.boardCacheByLocation.delete(location);
        }
      }
    };
    cacheEntry.refreshPromise.then(cleanUpRefresh, cleanUpRefresh);

    return cacheEntry.refreshPromise;
  }

  async fetch(request) {
    const url = new URL(request.url);

    try {
      if (request.method === 'GET' && url.pathname === '/stream') {
        return this.openSocket(request, url);
      }

      if (request.method === 'POST' && url.pathname === '/broadcast') {
        const requestBody = request.headers.get('content-type')?.includes('application/json')
          ? await request.json().catch(() => null)
          : null;

        await this.broadcast(url.searchParams.get('location'), {
          forceRefresh: url.searchParams.get('refresh') === '1',
          activityDelta: requestBody?.activityDelta || null,
          tileDelta: requestBody?.tileDelta || null,
        });
        return new Response(null, { status: 204 });
      }

      return json({ success: false, message: 'Endpoint not found' }, { status: 404 });
    } catch (error) {
      if (error instanceof FeebasRuleError) {
        return json({ success: false, message: error.message }, { status: error.statusCode });
      }

      console.error('Error handling Feebas stream Durable Object request:', error);
      return json({ success: false, message: 'Failed to handle Feebas stream request' }, { status: 500 });
    }
  }

  async openSocket(request, url) {
    if (!isWebSocketUpgrade(request)) {
      return webSocketUpgradeRequired();
    }

    if (!this.state || typeof this.state.acceptWebSocket !== 'function') {
      throw new Error('Durable Object WebSocket hibernation is not available.');
    }

    const location = url.searchParams.get('location');
    getLocationConfig(location);

    const actorFingerprint = feebasActorFingerprintSchema.validate(url.searchParams.get('actorFingerprint') || undefined).value;
    const lastActivityId = feebasLastActivityIdSchema.validate(url.searchParams.get('lastActivityId') || undefined).value;
    const repositories = this.createRepositories(this.env);
    const activityDelta = typeof repositories.feebas.getActivityDeltaSince === 'function'
      ? await repositories.feebas.getActivityDeltaSince(location, lastActivityId)
      : null;
    const { client, server } = createWebSocketPair();
    let metadata = {
      location,
      actorFingerprint,
      lastActivityId: lastActivityId || null,
    };

    this.state.acceptWebSocket(server);
    serializeFeebasSocketMetadata(server, metadata);
    if (hasFeebasActivityDelta({ data: activityDelta })) {
      sendFeebasSocketActivityDelta(server, { data: activityDelta }, actorFingerprint);
      metadata = rememberFeebasSocketActivityId(server, metadata, { data: activityDelta });
    }

    return createWebSocketUpgradeResponse(client);
  }

  async broadcast(location, options = {}) {
    getLocationConfig(location);

    const sockets = typeof this.state?.getWebSockets === 'function'
      ? this.state.getWebSockets()
      : [];
    const subscribers = sockets
      .map((socket) => ({
        socket,
        metadata: deserializeFeebasSocketMetadata(socket),
      }))
      .filter((subscriber) => subscriber.metadata?.location === location);

    if (subscribers.length === 0) {
      return;
    }

    if (hasFeebasTileDelta(options.tileDelta)) {
      subscribers.forEach((subscriber) => {
        try {
          sendFeebasSocketTileDelta(
            subscriber.socket,
            options.tileDelta,
            subscriber.metadata.actorFingerprint
          );
          subscriber.metadata = rememberFeebasSocketActivityId(
            subscriber.socket,
            subscriber.metadata,
            options.tileDelta
          );
        } catch {
          try {
            subscriber.socket.close(1011, 'Failed to send Feebas tile update');
          } catch {
            // Ignore sockets that are already closed.
          }
        }
      });
      return;
    }

    if (hasFeebasActivityDelta(options.activityDelta)) {
      subscribers.forEach((subscriber) => {
        try {
          sendFeebasSocketActivityDelta(
            subscriber.socket,
            options.activityDelta,
            subscriber.metadata.actorFingerprint
          );
          subscriber.metadata = rememberFeebasSocketActivityId(
            subscriber.socket,
            subscriber.metadata,
            options.activityDelta
          );
        } catch {
          try {
            subscriber.socket.close(1011, 'Failed to send Feebas activity update');
          } catch {
            // Ignore sockets that are already closed.
          }
        }
      });
    }

    const repositories = this.createRepositories(this.env);
    const now = Date.now();
    let boardCache = null;

    let cacheEntry = this.boardCacheByLocation.get(location);
    if (!options.forceRefresh && cacheEntry?.board && cacheEntry.expiresAt > now) {
      boardCache = cacheEntry.board;
    } else {
      if (!cacheEntry) {
        cacheEntry = {
          board: null,
          expiresAt: 0,
          needsRefresh: false,
          refreshPromise: null,
        };
        this.boardCacheByLocation.set(location, cacheEntry);
      } else if (options.forceRefresh) {
        cacheEntry.expiresAt = 0;
      }

      const mustWaitForDirtyRefresh = Boolean(options.forceRefresh && cacheEntry.refreshPromise);
      if (mustWaitForDirtyRefresh) {
        cacheEntry.needsRefresh = true;
      }

      let refreshPromise = cacheEntry.refreshPromise || this.startBoardCacheRefresh(location, repositories, cacheEntry);

      try {
        boardCache = await refreshPromise;

        while (mustWaitForDirtyRefresh && (cacheEntry.needsRefresh || cacheEntry.refreshPromise)) {
          refreshPromise = cacheEntry.refreshPromise || this.startBoardCacheRefresh(location, repositories, cacheEntry);
          boardCache = await refreshPromise;
        }
      } catch (error) {
        console.error('Error fetching Feebas board cache:', error);
      }
    }

    await Promise.all(subscribers.map(async (subscriber) => {
      try {
        const board = boardCache
          ? (
              subscriber.metadata.actorFingerprint && typeof repositories.feebas.applyUserViewToBoardCache === 'function'
                ? repositories.feebas.applyUserViewToBoardCache(boardCache, subscriber.metadata.actorFingerprint)
                : boardCache
            )
          : await repositories.feebas.getBoard(location, {
              actorFingerprint: subscriber.metadata.actorFingerprint,
              includeLeaderboard: false,
            });
        sendFeebasSocketBoard(subscriber.socket, board);
        subscriber.metadata = rememberFeebasSocketActivityId(
          subscriber.socket,
          subscriber.metadata,
          { data: board }
        );
      } catch {
        try {
          subscriber.socket.close(1011, 'Failed to refresh Feebas board');
        } catch {
          // Ignore sockets that are already closed.
        }
      }
    }));
  }

  webSocketClose(socket) {
    try {
      socket.close();
    } catch {
      // The socket may already be closed by the runtime.
    }
  }

  webSocketError(socket) {
    try {
      socket.close(1011, 'Feebas live updates failed');
    } catch {
      // The socket may already be closed by the runtime.
    }
  }
}


module.exports = {
  FeebasBoardStreamDurableObject,
  getLatestFeebasActivityId,
  hasFeebasActivityDelta,
  hasFeebasTileDelta,
  sendFeebasSocketActivityDelta,
  sendFeebasSocketTileDelta,
};
