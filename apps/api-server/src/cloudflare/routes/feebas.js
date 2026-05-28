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
        await broadcastFeebasBoard(match[1], getRepositories(), env);
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

        if (!isWebSocketUpgrade(request)) {
          return webSocketUpgradeRequired();
        }

        const durableObject = getFeebasStreamDurableObject(env, match[1]);
        if (durableObject) {
          return durableObject.fetch(createFeebasStreamDurableObjectRequest('/stream', match[1], actorFingerprint, {
            method: 'GET',
            headers: request.headers,
          }));
        }

        const board = await getRepositories().feebas.getBoard(match[1], {
          actorFingerprint,
          includeLeaderboard: false,
        });

        return createFeebasSocketResponse(request, match[1], actorFingerprint, board);
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
        await broadcastFeebasBoard(match[1], getRepositories(), env);
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
