const {
  authenticateBotRequest,
  buildCorsHeaders,
  buildEmailVerificationMessage,
  clearAuthCookie,
  createFeebasStreamDurableObjectRequest,
  createRepositories,
  createWebSocketPair,
  createWebSocketUpgradeResponse,
  deserializeFeebasSocketMetadata,
  emailVerificationExpiresInMinutes,
  empty,
  encodeFeebasSocketMessage,
  FeebasRuleError,
  generateBotToken,
  getEmailVerificationUrl,
  getFeebasStreamDurableObject,
  getLocationConfig,
  getTokenFromRequest,
  isWebSocketUpgrade,
  json,
  normalizeLegacySetCookie,
  randomHex,
  readJson,
  sendEmail,
  feebasActorFingerprintSchema,
  feebasLastActivityIdSchema,
  serializeFeebasSocketMetadata,
  setAuthCookie,
  sha256Hex,
  shouldNormalizeLegacyCookie,
  signUserToken,
  sendFeebasSocketBoard,
  verifyUserToken,
  webSocketUpgradeRequired,
  withStandardHeaders,
} = require('./services/worker-support');
const { handleAuthRoutes } = require('./routes/auth');
const { handleMembersRoutes } = require('./routes/members');
const { handleShiniesRoutes } = require('./routes/shinies');
const { handleCatchEventsRoutes } = require('./routes/catch-events');
const { handleFeebasRoutes } = require('./routes/feebas');

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


function createWorkerApp(options = {}) {
  const createRepos = options.createRepositories || createRepositories;
  const fetchImpl = options.fetch || fetch;
  const feebasSubscribersByLocation = new Map();

  function removeFeebasSubscriber(location, subscriber) {
    const subscribers = feebasSubscribersByLocation.get(location);
    if (!subscribers) return;

    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      feebasSubscribersByLocation.delete(location);
    }
  }

  function createFeebasSocketResponse(request, location, actorFingerprint, options = {}) {
    if (!isWebSocketUpgrade(request)) {
      return webSocketUpgradeRequired();
    }

    let subscriber;
    let isClosed = false;
    const subscribers = feebasSubscribersByLocation.get(location) || new Set();
    const { client, server } = createWebSocketPair();

    const cleanup = () => {
      if (isClosed) {
        return;
      }

      isClosed = true;
      removeFeebasSubscriber(location, subscriber);
      try {
        server.close();
      } catch {
        // The socket may already be closed by the client.
      }
    };

    const handleAbort = () => {
      cleanup();
    };

    subscriber = {
      socket: server,
      actorFingerprint,
      lastActivityId: options.lastActivityId || null,
      cleanup,
    };
    subscribers.add(subscriber);
    feebasSubscribersByLocation.set(location, subscribers);

    if (typeof server.accept === 'function') {
      server.accept();
    }

    if (hasFeebasActivityDelta({ data: options.activityDelta })) {
      sendFeebasSocketActivityDelta(server, { data: options.activityDelta }, actorFingerprint);
      subscriber.lastActivityId = getLatestFeebasActivityId({ data: options.activityDelta }) || subscriber.lastActivityId;
    }
    server.addEventListener?.('close', cleanup);
    server.addEventListener?.('error', cleanup);
    request.signal?.addEventListener('abort', handleAbort, { once: true });
    subscriber.cleanup = () => {
      request.signal?.removeEventListener('abort', handleAbort);
      server.removeEventListener?.('close', cleanup);
      server.removeEventListener?.('error', cleanup);
      cleanup();
    };

    return createWebSocketUpgradeResponse(client);
  }

  async function broadcastFeebasBoard(location, repositories, env, options = {}) {
    const durableObject = getFeebasStreamDurableObject(env, location);

    if (durableObject) {
      try {
        const pathname = options.forceRefresh ? '/broadcast?refresh=1' : '/broadcast';
        const requestInit = {
          method: 'POST',
        };

        if (hasFeebasTileDelta(options.tileDelta) || hasFeebasActivityDelta(options.activityDelta)) {
          requestInit.headers = {
            'content-type': 'application/json',
          };
          requestInit.body = JSON.stringify({
            ...(hasFeebasTileDelta(options.tileDelta) ? { tileDelta: options.tileDelta } : {}),
            ...(hasFeebasActivityDelta(options.activityDelta) ? { activityDelta: options.activityDelta } : {}),
          });
        }

        await durableObject.fetch(createFeebasStreamDurableObjectRequest(pathname, location, null, {
          ...requestInit,
        }));
      } catch (error) {
        console.error('Error broadcasting Feebas board through Durable Object:', error);
      }
      return;
    }

    const subscribers = feebasSubscribersByLocation.get(location);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    if (hasFeebasActivityDelta(options.activityDelta)) {
      Array.from(subscribers).forEach((subscriber) => {
        try {
          sendFeebasSocketActivityDelta(subscriber.socket, options.activityDelta, subscriber.actorFingerprint);
          subscriber.lastActivityId = getLatestFeebasActivityId(options.activityDelta) || subscriber.lastActivityId;
        } catch {
          subscriber.cleanup?.();
        }
      });
    }

    if (hasFeebasTileDelta(options.tileDelta)) {
      Array.from(subscribers).forEach((subscriber) => {
        try {
          sendFeebasSocketTileDelta(subscriber.socket, options.tileDelta, subscriber.actorFingerprint);
          subscriber.lastActivityId = getLatestFeebasActivityId(options.tileDelta) || subscriber.lastActivityId;
        } catch {
          subscriber.cleanup?.();
        }
      });
      return;
    }

    const boardCache = typeof repositories.feebas.getBoardCache === 'function'
      ? await repositories.feebas.getBoardCache(location)
      : null;

    await Promise.all(Array.from(subscribers).map(async (subscriber) => {
      try {
        const board = boardCache
          ? (
              subscriber.actorFingerprint && typeof repositories.feebas.applyUserViewToBoardCache === 'function'
                ? repositories.feebas.applyUserViewToBoardCache(boardCache, subscriber.actorFingerprint)
                : boardCache
            )
          : await repositories.feebas.getBoard(location, {
              actorFingerprint: subscriber.actorFingerprint,
              includeLeaderboard: false,
            });
        sendFeebasSocketBoard(subscriber.socket, board);
        subscriber.lastActivityId = getLatestFeebasActivityId({ data: board }) || subscriber.lastActivityId;
      } catch {
        subscriber.cleanup?.();
      }
    }));
  }

  async function maybeProxyLegacyRequest(request, env) {
    const url = new URL(request.url);
    const legacyBase = env.LEGACY_API_BASE_URL;
    if (!legacyBase) {
      return json({
        success: false,
        message: 'This endpoint is still served by the legacy Node API. Configure LEGACY_API_BASE_URL to proxy it during migration.',
      }, { status: 501 });
    }

    const proxyUrl = new URL(url.pathname + url.search, legacyBase);
    const response = await fetchImpl(proxyUrl, {
      method: request.method,
      headers: request.headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.clone().arrayBuffer(),
    });

    if (url.pathname.startsWith('/api/auth/') && shouldNormalizeLegacyCookie(request, env)) {
      const headers = new Headers(response.headers);
      const setCookies = typeof headers.getSetCookie === 'function'
        ? headers.getSetCookie()
        : [headers.get('set-cookie')].filter(Boolean);

      if (setCookies.length > 0) {
        headers.delete('set-cookie');
        setCookies.forEach((cookie) => {
          headers.append('set-cookie', normalizeLegacySetCookie(cookie));
        });

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    }

    return response;
  }

  function isLegacyProxyPath(pathname) {
    const workerAuthPaths = new Set([
      '/api/auth/me',
      '/api/auth/logout',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/auth/change-email',
      '/api/auth/change-password',
      '/api/auth/verify-email',
      '/api/auth/register',
      '/api/auth/login',
      '/api/auth/discord',
      '/api/auth/discord/session',
      '/api/auth/discord/callback',
    ]);

    return pathname === '/api/shinies/from-screenshot'
      || pathname === '/api/shinies/from-screenshot/async'
      || pathname.startsWith('/api/shinies/sprites/')
      || (pathname.startsWith('/api/auth/') && !workerAuthPaths.has(pathname));
  }

  async function requireBotAuth(request, env) {
    const auth = await authenticateBotRequest(request, env);
    if (!auth.ok) {
      return json(auth.response.body, { status: auth.response.status });
    }
    return null;
  }

  async function getAuthenticatedUser(request, env, repositories) {
    const token = getTokenFromRequest(request, env);
    if (!token) return null;

    try {
      const decoded = await verifyUserToken(token, env);
      return repositories.users.findById(decoded.sub);
    } catch {
      return null;
    }
  }

  async function requireUser(request, env, repositories) {
    const token = getTokenFromRequest(request, env);
    if (!token) {
      return {
        response: json({ success: false, message: 'Not signed in.' }, { status: 401 }),
      };
    }

    try {
      const decoded = await verifyUserToken(token, env);
      const user = await repositories.users.findById(decoded.sub);
      if (!user) {
        return {
          response: json({
            success: false,
            message: 'Invalid or expired session.',
          }, {
            status: 401,
            headers: { 'set-cookie': clearAuthCookie(env) },
          }),
        };
      }
      return { user };
    } catch {
      return {
        response: json({ success: false, message: 'Invalid or expired session.' }, { status: 401 }),
      };
    }
  }

  async function signInUser(env, repositories, user, statusCode = 200, message = 'Signed in successfully.') {
    const loggedInUser = await repositories.users.recordLogin(user.id);
    const safeUser = repositories.users.toSafeUser(loggedInUser || user);
    const token = await signUserToken(safeUser, env);

    return json({
      success: true,
      data: safeUser,
      message,
    }, {
      status: statusCode,
      headers: { 'set-cookie': setAuthCookie(token, env) },
    });
  }

  async function issueEmailVerification(fetchImpl, env, repositories, user) {
    const token = randomHex(32);
    const expiresAt = new Date(Date.now() + (emailVerificationExpiresInMinutes * 60 * 1000));

    await repositories.users.setEmailVerificationToken(user.id, {
      tokenHash: await sha256Hex(token),
      expiresAt,
    });

    await sendEmail(fetchImpl, env, buildEmailVerificationMessage({
      to: user.email,
      verificationUrl: getEmailVerificationUrl(env, token),
      expiresInMinutes: emailVerificationExpiresInMinutes,
      ign: user.ign,
    }));
  }


  async function routeRequest(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    let repositories;
    const getRepositories = () => {
      repositories = repositories || options.repositories || createRepos(env);
      return repositories;
    };

    if (request.method === 'OPTIONS') {
      return empty(204, { headers: buildCorsHeaders(request, env) });
    }

    if (isLegacyProxyPath(pathname)) {
      return maybeProxyLegacyRequest(request, env, ctx);
    }

    if (request.method === 'GET' && pathname === '/health') {
      return json({
        success: true,
        message: 'Team Soju API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      });
    }

    if (request.method === 'GET' && pathname === '/generate-bot-token') {
      if (env.NODE_ENV === 'production') {
        return json({
          success: false,
          message: 'Token generation not available in production',
        }, { status: 403 });
      }

      const token = await generateBotToken(env.JWT_SECRET);
      return json({
        success: true,
        token,
        message: 'Bot token generated successfully',
      });
    }

    const routeContext = {
      request,
      env,
      ctx,
      url,
      pathname,
      fetchImpl,
      getRepositories,
      requireBotAuth,
      getAuthenticatedUser,
      requireUser,
      signInUser,
      issueEmailVerification,
      maybeProxyLegacyRequest,
      broadcastFeebasBoard,
      createFeebasSocketResponse,
    };

    const routeHandlers = [
      handleAuthRoutes,
      handleMembersRoutes,
      handleShiniesRoutes,
      handleCatchEventsRoutes,
      handleFeebasRoutes,
    ];

    for (const handleRoute of routeHandlers) {
      const response = await handleRoute(routeContext);
      if (response) {
        return response;
      }
    }

    return json({
      success: false,
      message: 'Endpoint not found',
    }, { status: 404 });
  }

  return {
    async fetch(request, env = {}, ctx = {}) {
      console.log(`${new Date().toISOString()} - ${request.method} ${new URL(request.url).pathname}`);

      try {
        const response = await routeRequest(request, env, ctx);
        return withStandardHeaders(response, request, env);
      } catch (error) {
        console.error('Global error handler:', error);
        return withStandardHeaders(json({
          success: false,
          message: 'Internal server error',
          ...(env.NODE_ENV === 'development' && { error: error.message }),
        }, { status: 500 }), request, env);
      }
    },
  };
}

module.exports = {
  createWorkerApp,
  FeebasBoardStreamDurableObject,
  fetch: (...args) => createWorkerApp().fetch(...args),
};
