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
  randomHex,
  readJson,
  sendEmail,
  feebasActorFingerprintSchema,
  feebasLastActivityIdSchema,
  serializeFeebasSocketMetadata,
  setAuthCookie,
  sha256Hex,
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
const { handleShinyWarRoutes } = require('./routes/shiny-war');
const { handleHuntFinderRoutes } = require('./routes/hunt-finder');
const { createCloudflareAuthorization } = require('./authorization');
const {
  FeebasBoardStreamDurableObject,
  getLatestFeebasActivityId,
  hasFeebasActivityDelta,
  hasFeebasTileDelta,
  sendFeebasSocketActivityDelta,
  sendFeebasSocketTileDelta,
} = require('./feebas-stream');


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
    const safeUser = await getAuthorizedSafeUser(repositories, loggedInUser || user);
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

  const {
    getAuthorizedSafeUser,
    getAuthorizationResult,
    requirePermission,
    requireTeamMember,
  } = createCloudflareAuthorization({ json, requireUser });

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
      getAuthorizedSafeUser,
      getAuthorizationResult,
      requirePermission,
      requireTeamMember,
      signInUser,
      issueEmailVerification,
      broadcastFeebasBoard,
      createFeebasSocketResponse,
    };

    const routeHandlers = [
      handleAuthRoutes,
      handleMembersRoutes,
      handleShiniesRoutes,
      handleCatchEventsRoutes,
      handleFeebasRoutes,
      handleHuntFinderRoutes,
      handleShinyWarRoutes,
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
