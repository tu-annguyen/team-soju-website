const {
  buildShinyFilters,
  enrichShinyPayloadWithVariants,
  memberSchema,
  shinySchema,
  updateMemberSchema,
  updateShinySchema,
  Joi,
  authenticateBotRequest,
  clearAuthCookie,
  generateBotToken,
  getTokenFromRequest,
  setAuthCookie,
  signJwt,
  signUserToken,
  verifyJwt,
  verifyUserToken,
  createRepositories,
  buildCorsHeaders,
  empty,
  json,
  readJson,
  withStandardHeaders,
  FeebasRuleError,
  getLocationConfig,
  isIgnBlacklisted,
  passwordResetExpiresInMinutes,
  passwordResetSentMessage,
  emailVerificationExpiresInMinutes,
  emailVerificationSentMessage,
  discordScopes,
  passwordMigrationMessage,
  discordHandoffTokenType,
  discordHandoffExpiresIn,
  discordHandoffHashParam,
  updateFeebasTileSchema,
  feebasActorFingerprintSchema,
  feebasLastActivityIdSchema,
  passwordSchema,
  forgotPasswordSchema,
  registerSchema,
  loginSchema,
  resetPasswordSchema,
  changeEmailSchema,
  changePasswordSchema,
  verifyEmailSchema,
  discordStartSchema,
  discordSessionSchema,
  catchEventRuleSchema,
  catchEventCreateSchema,
  catchEventSubmissionSchema,
  catchEventOcrSchema,
  catchEventPublishSchema,
  catchEventSubmissionsClosedSchema,
  catchEventAutoCheckSchema,
  catchEventSubmissionStatusSchema,
  catchEventSubmissionUpdateSchema,
  catchEventCollaboratorSchema,
  pokemonNatures,
  normalizeCatchEventText,
  getDateTimePartsInZone,
  getTimezoneOffsetMs,
  zonedLocalDateTimeToUtc,
  calculateCatchEventScore,
  validateCatchEventSubmissionPayload,
  getEnvUrl,
  getWebAppUrl,
  getApiOrigin,
  getDiscordRedirectUri,
  getDiscordConfig,
  getEmailVerificationUrl,
  getPasswordResetUrl,
  buildWebRedirect,
  buildDiscordHandoffRedirect,
  redirect,
  sanitizeReturnTo,
  getDiscordScopeParam,
  getBlacklistedIgnMessage,
  buildState,
  verifyState,
  buildDiscordHandoffToken,
  verifyDiscordHandoffToken,
  escapeHtml,
  parseScreenshotDataUrl,
  sanitizeFileName,
  extractAiResponseText,
  parseAiJson,
  cleanNullableString,
  inferDateOrderFromLocaleTimezone,
  normalizeOcrCatchLocal,
  normalizeCatchEventOcrResult,
  mergeCatchEventOcrResults,
  isLocalAiBindingError,
  getCloudflareAiRestConfig,
  createLocalAiConfigError,
  runCloudflareAiRest,
  runCatchEventOcrModel,
  extractCatchEventScreenshotFields,
  storeCatchEventScreenshots,
  buildPasswordResetMessage,
  buildEmailVerificationMessage,
  sendEmail,
  exchangeDiscordCode,
  fetchDiscordUser,
  getCrypto,
  randomHex,
  sha256Hex,
  derivePasswordHash,
  verifyPassword,
  isExpired,
  duplicateAuthMessage,
  isLocalhost,
  shouldNormalizeLegacyCookie,
  normalizeLegacySetCookie,
  encodeFeebasSocketMessage,
  createFeebasStreamDurableObjectRequest,
  isWebSocketUpgrade,
  webSocketUpgradeRequired,
  createWebSocketPair,
  createWebSocketUpgradeResponse,
  serializeFeebasSocketMetadata,
  deserializeFeebasSocketMetadata,
  sendFeebasSocketBoard,
  getFeebasStreamDurableObject,
} = require('../services/worker-support');

const FEEBAS_ACTIVITY_DELTA_MAX_AGE_MS = 30000;
const FEEBAS_PUBLIC_BOARD_CACHE_SECONDS = 15;

function getExpectedFeebasActivityNextStatus(status) {
  return status === 'unchecked' ? null : status;
}

function buildFeebasActivityDelta(board, actorFingerprint, { tileId, status } = {}) {
  const latestActivity = Array.isArray(board?.activity) ? board.activity[0] : null;
  if (!latestActivity) {
    return null;
  }

  if (tileId && latestActivity.tileId !== tileId) {
    return null;
  }

  if (status && latestActivity.nextStatus !== getExpectedFeebasActivityNextStatus(status)) {
    return null;
  }

  const boardTime = Date.parse(board.serverTime || '');
  const activityTime = Date.parse(latestActivity.createdAt || '');
  if (
    !Number.isFinite(boardTime)
    || !Number.isFinite(activityTime)
    || Math.abs(boardTime - activityTime) > FEEBAS_ACTIVITY_DELTA_MAX_AGE_MS
  ) {
    return null;
  }

  return {
    actorFingerprint,
    data: {
      location: board.location,
      displayName: board.displayName,
      cycleStart: board.cycleStart,
      cycleEnd: board.cycleEnd,
      serverTime: board.serverTime,
      activity: [latestActivity],
    },
  };
}

function stripFeebasCurrentUserVotes(board) {
  return {
    ...board,
    tiles: (board.tiles || []).map(({ currentUserVote, ...tile }) => tile),
  };
}

function buildFeebasTileDelta(board, actorFingerprint, { tileId, status } = {}) {
  const activityDelta = buildFeebasActivityDelta(board, actorFingerprint, { tileId, status });
  const changedTile = (board.tiles || []).find((tile) => tile.tileId === tileId);

  if (!changedTile) {
    return null;
  }

  const { currentUserVote, ...publicTile } = changedTile;

  return {
    actorFingerprint,
    data: {
      ...(activityDelta?.data || {
        location: board.location,
        displayName: board.displayName,
        cycleStart: board.cycleStart,
        cycleEnd: board.cycleEnd,
        serverTime: board.serverTime,
        activity: [],
      }),
      tiles: [{
        tileId: publicTile.tileId,
        status: publicTile.status,
        voteCounts: publicTile.voteCounts,
        totalVotes: publicTile.totalVotes,
      }],
    },
  };
}

async function handleFeebasRoutes(context) {
  const {
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
  } = context;
  let match;

    match = pathname.match(/^\/api\/feebas\/([^/]+)\/leaderboard$/);
    if (request.method === 'GET' && match) {
      try {
        getLocationConfig(match[1]);
        const leaderboardSortKeys = getRepositories().feebas.getLeaderboardSortOptions().map((option) => option.key);
        const leaderboardQuerySchema = Joi.object({
          limit: Joi.number().integer().min(1).max(50).optional(),
          sortBy: Joi.string().valid(...leaderboardSortKeys).optional(),
          sortDirection: Joi.string().valid('asc', 'desc').optional(),
        });
        const { error, value } = leaderboardQuerySchema.validate(Object.fromEntries(url.searchParams.entries()));

        if (error) {
          return json({
            success: false,
            message: 'Validation error',
            details: error.details,
          }, { status: 400 });
        }

        const authenticatedUser = await getAuthenticatedUser(request, env, getRepositories());
        const leaderboard = await getRepositories().feebas.getLeaderboard(match[1], {
          ...value,
          currentUserId: authenticatedUser?.id,
        });
        return json({
          success: true,
          data: leaderboard,
        });
      } catch (error) {
        if (error instanceof FeebasRuleError) {
          return json({ success: false, message: error.message }, { status: error.statusCode });
        }

        console.error('Error fetching Feebas leaderboard:', error);
        return json({ success: false, message: 'Failed to fetch Feebas leaderboard' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/feebas\/([^/]+)\/tiles\/([^/]+)$/);
    if (request.method === 'POST' && match) {
      try {
        getLocationConfig(match[1]);
        const body = await readJson(request);
        const { error, value } = updateFeebasTileSchema.validate(body);

        if (error) {
          return json({
            success: false,
            message: 'Validation error',
            details: error.details,
          }, { status: 400 });
        }

        const board = await getRepositories().feebas.updateTile(match[1], match[2], value, {
          includeLeaderboard: false,
        });
        const tileDelta = buildFeebasTileDelta(board, value.actorFingerprint, {
          tileId: match[2],
          status: value.status,
        });
        if (tileDelta) {
          await broadcastFeebasBoard(match[1], getRepositories(), env, { tileDelta });
        }
        return json({
          success: true,
          data: board,
          message: 'Feebas tile updated successfully',
        });
      } catch (error) {
        if (error instanceof FeebasRuleError) {
          return json({ success: false, message: error.message }, { status: error.statusCode });
        }

        console.error('Error updating Feebas tile:', error);
        return json({ success: false, message: 'Failed to update Feebas tile' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/feebas\/([^/]+)\/stream$/);
    if (request.method === 'GET' && match) {
      try {
        getLocationConfig(match[1]);
        const actorFingerprint = feebasActorFingerprintSchema.validate(url.searchParams.get('actorFingerprint') || undefined).value;
        const lastActivityId = feebasLastActivityIdSchema.validate(url.searchParams.get('lastActivityId') || undefined).value;

        if (!isWebSocketUpgrade(request)) {
          return webSocketUpgradeRequired();
        }

        const durableObject = getFeebasStreamDurableObject(env, match[1]);
        if (durableObject) {
          return durableObject.fetch(createFeebasStreamDurableObjectRequest('/stream', match[1], actorFingerprint, {
            method: 'GET',
            headers: request.headers,
          }, { lastActivityId }));
        }

        const activityDelta = typeof getRepositories().feebas.getActivityDeltaSince === 'function'
          ? await getRepositories().feebas.getActivityDeltaSince(match[1], lastActivityId)
          : null;

        return createFeebasSocketResponse(request, match[1], actorFingerprint, {
          lastActivityId,
          activityDelta,
        });
      } catch (error) {
        if (error instanceof FeebasRuleError) {
          return json({ success: false, message: error.message }, { status: error.statusCode });
        }

        console.error('Error opening Feebas stream:', error);
        return json({ success: false, message: 'Failed to open Feebas stream' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/feebas\/([^/]+)\/reset$/);
    if (request.method === 'POST' && match) {
      if (env.NODE_ENV === 'production') {
        return json({
          success: false,
          message: 'Feebas board reset is not available in production',
        }, { status: 403 });
      }

      try {
        getLocationConfig(match[1]);
        const board = await getRepositories().feebas.resetBoard(match[1]);
        await broadcastFeebasBoard(match[1], getRepositories(), env, { forceRefresh: true });
        return json({
          success: true,
          data: board,
          message: 'Feebas board reset successfully',
        });
      } catch (error) {
        if (error instanceof FeebasRuleError) {
          return json({ success: false, message: error.message }, { status: error.statusCode });
        }

        console.error('Error resetting Feebas board:', error);
        return json({ success: false, message: 'Failed to reset Feebas board' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/feebas\/([^/]+)\/public$/);
    if (request.method === 'GET' && match) {
      try {
        getLocationConfig(match[1]);
        const board = await getRepositories().feebas.getBoard(match[1], {
          includeLeaderboard: false,
        });

        return json({
          success: true,
          data: stripFeebasCurrentUserVotes(board),
        }, {
          headers: {
            'cache-control': `public, max-age=${FEEBAS_PUBLIC_BOARD_CACHE_SECONDS}, s-maxage=${FEEBAS_PUBLIC_BOARD_CACHE_SECONDS}, stale-while-revalidate=30`,
          },
        });
      } catch (error) {
        if (error instanceof FeebasRuleError) {
          return json({ success: false, message: error.message }, { status: error.statusCode });
        }

        console.error('Error fetching public Feebas board:', error);
        return json({ success: false, message: 'Failed to fetch Feebas board' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/feebas\/([^/]+)\/votes$/);
    if (request.method === 'GET' && match) {
      try {
        getLocationConfig(match[1]);
        const actorFingerprint = feebasActorFingerprintSchema.validate(url.searchParams.get('actorFingerprint') || undefined).value;
        const tiles = typeof getRepositories().feebas.getCurrentVotes === 'function'
          ? await getRepositories().feebas.getCurrentVotes(match[1], actorFingerprint)
          : (await getRepositories().feebas.getBoard(match[1], {
              actorFingerprint,
              includeLeaderboard: false,
            })).tiles.map((tile) => ({
              tileId: tile.tileId,
              currentUserVote: tile.currentUserVote,
            }));

        return json({
          success: true,
          data: { location: match[1], tiles },
        }, {
          headers: {
            'cache-control': 'private, no-store',
          },
        });
      } catch (error) {
        if (error instanceof FeebasRuleError) {
          return json({ success: false, message: error.message }, { status: error.statusCode });
        }

        console.error('Error fetching Feebas current votes:', error);
        return json({ success: false, message: 'Failed to fetch Feebas current votes' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/feebas\/([^/]+)$/);
    if (request.method === 'GET' && match) {
      try {
        getLocationConfig(match[1]);
        const actorFingerprint = feebasActorFingerprintSchema.validate(url.searchParams.get('actorFingerprint') || undefined).value;
        const authenticatedUser = await getAuthenticatedUser(request, env, getRepositories());
        const board = await getRepositories().feebas.getBoard(match[1], {
          actorFingerprint,
          currentUserId: authenticatedUser?.id,
        });

        return json({
          success: true,
          data: board,
        });
      } catch (error) {
        if (error instanceof FeebasRuleError) {
          return json({ success: false, message: error.message }, { status: error.statusCode });
        }

        console.error('Error fetching Feebas board:', error);
        return json({ success: false, message: 'Failed to fetch Feebas board' }, { status: 500 });
      }
    }

  return null;
}

module.exports = { handleFeebasRoutes };
