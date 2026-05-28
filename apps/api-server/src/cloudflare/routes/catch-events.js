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

async function handleCatchEventsRoutes(context) {
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

    if (request.method === 'GET' && pathname === '/api/catch-events') {
      try {
        const authenticatedUser = await getAuthenticatedUser(request, env, getRepositories());
        const ownerOnly = url.searchParams.get('owner') === 'me';

        if (ownerOnly && !authenticatedUser) {
          return json({ success: false, message: 'Not signed in.' }, { status: 401 });
        }

        const events = await getRepositories().catchEvents.listEvents({
          manageableByUserId: ownerOnly ? authenticatedUser.id : undefined,
          publishedOnly: url.searchParams.get('published') === 'true',
        });
        return json({ success: true, data: events });
      } catch (error) {
        console.error('Error listing catch events:', error);
        return json({ success: false, message: 'Failed to list catch events' }, { status: 500 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/catch-events') {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const body = await readJson(request);
        const { error, value } = catchEventCreateSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const event = await getRepositories().catchEvents.createEvent(auth.user, value);
        return json({ success: true, data: event, message: 'Catch event created successfully' }, { status: 201 });
      } catch (error) {
        console.error('Error creating catch event:', error);
        return json({ success: false, message: 'Failed to create catch event' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)$/);
    if (request.method === 'PUT' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const body = await readJson(request);
        const { error, value } = catchEventCreateSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const event = await getRepositories().catchEvents.updateEvent(match[1], auth.user.id, value);
        if (!event) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        return json({ success: true, data: event, message: 'Catch event updated successfully' });
      } catch (error) {
        console.error('Error updating catch event:', error);
        return json({ success: false, message: 'Failed to update catch event' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)$/);
    if (request.method === 'DELETE' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const event = await getRepositories().catchEvents.deleteEvent(match[1], auth.user.id);
        if (!event) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        return json({ success: true, data: event, message: 'Catch event deleted successfully' });
      } catch (error) {
        console.error('Error deleting catch event:', error);
        return json({ success: false, message: 'Failed to delete catch event' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)\/collaborators$/);
    if (request.method === 'GET' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const collaborators = await getRepositories().catchEvents.listCollaborators(match[1], auth.user.id);
        if (!collaborators) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        return json({ success: true, data: collaborators });
      } catch (error) {
        console.error('Error listing catch event collaborators:', error);
        return json({ success: false, message: 'Failed to list shared admins' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)\/collaborators$/);
    if (request.method === 'POST' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const body = await readJson(request);
        const { error, value } = catchEventCollaboratorSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        let user;
        try {
          user = await getRepositories().users.findByEmailOrIgn(value.identifier);
        } catch (lookupError) {
          if (lookupError.code === 'AMBIGUOUS_ACCOUNT_IDENTIFIER') {
            return json({ success: false, message: lookupError.message }, { status: 409 });
          }
          throw lookupError;
        }

        if (!user) {
          return json({ success: false, message: 'Team Soju account not found' }, { status: 404 });
        }

        const collaborators = await getRepositories().catchEvents.addCollaborator(match[1], auth.user.id, user);
        if (!collaborators) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        return json({ success: true, data: collaborators, message: 'Shared admin added successfully' }, { status: 201 });
      } catch (error) {
        if (error.code === 'SELF_COLLABORATOR') {
          return json({ success: false, message: error.message }, { status: 400 });
        }
        console.error('Error adding catch event collaborator:', error);
        return json({ success: false, message: 'Failed to add shared admin' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)\/collaborators\/([^/]+)$/);
    if (request.method === 'DELETE' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const collaborators = await getRepositories().catchEvents.removeCollaborator(
          match[1],
          auth.user.id,
          decodeURIComponent(match[2])
        );
        if (!collaborators) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        return json({ success: true, data: collaborators, message: 'Shared admin removed successfully' });
      } catch (error) {
        console.error('Error removing catch event collaborator:', error);
        return json({ success: false, message: 'Failed to remove shared admin' }, { status: 500 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/catch-events/ocr') {
      try {
        const body = await readJson(request);
        const { error, value } = catchEventOcrSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const data = await extractCatchEventScreenshotFields(env, value.screenshots, {
          locale: value.locale,
          timezone: value.timezone,
        });
        return json({ success: true, data });
      } catch (error) {
        if (error.statusCode !== 503) {
          console.error('Error reading catch event screenshots:', error);
        }
        return json({
          success: false,
          message: error.statusCode === 503
            ? error.message
            : 'Failed to read screenshots',
        }, { status: error.statusCode || 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/screenshots\/([^/]+)$/);
    if (request.method === 'GET' && match) {
      try {
        const screenshot = await getRepositories().catchEvents.getScreenshotById(match[1]);
        if (!screenshot) {
          return json({ success: false, message: 'Screenshot not found' }, { status: 404 });
        }
        if (!env.CATCH_EVENT_SCREENSHOTS) {
          return json({ success: false, message: 'Screenshot storage is not configured' }, { status: 503 });
        }

        const object = await env.CATCH_EVENT_SCREENSHOTS.get(screenshot.storageKey);
        if (!object) {
          return json({ success: false, message: 'Screenshot not found' }, { status: 404 });
        }

        return new Response(object.body, {
          headers: {
            'content-type': object.httpMetadata?.contentType || screenshot.contentType || 'application/octet-stream',
            'cache-control': 'private, max-age=60',
          },
        });
      } catch (error) {
        console.error('Error fetching catch event screenshot:', error);
        return json({ success: false, message: 'Failed to fetch screenshot' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)\/publish$/);
    if (request.method === 'POST' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const body = await readJson(request);
        const { error, value } = catchEventPublishSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const event = await getRepositories().catchEvents.setLeaderboardPublished(
          match[1],
          auth.user.id,
          value.isLeaderboardPublished
        );
        if (!event) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        return json({ success: true, data: event, message: 'Catch event updated successfully' });
      } catch (error) {
        console.error('Error publishing catch event leaderboard:', error);
        return json({ success: false, message: 'Failed to update catch event' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)\/submissions-closed$/);
    if (request.method === 'POST' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const body = await readJson(request);
        const { error, value } = catchEventSubmissionsClosedSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const event = await getRepositories().catchEvents.setSubmissionsClosed(
          match[1],
          auth.user.id,
          value.submissionsClosed
        );
        if (!event) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        return json({ success: true, data: event, message: 'Catch event updated successfully' });
      } catch (error) {
        console.error('Error updating catch event submissions:', error);
        return json({ success: false, message: 'Failed to update catch event submissions' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)\/auto-check$/);
    if (request.method === 'POST' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const body = await readJson(request);
        const { error, value } = catchEventAutoCheckSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const event = await getRepositories().catchEvents.setAutoCheckEnabled(
          match[1],
          auth.user.id,
          value.autoCheckEnabled
        );
        if (!event) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        return json({ success: true, data: event, message: 'Catch event updated successfully' });
      } catch (error) {
        console.error('Error updating catch event auto-check:', error);
        return json({ success: false, message: 'Failed to update catch event auto-check' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)\/submissions\/([^/]+)\/status$/);
    if (request.method === 'POST' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const body = await readJson(request);
        const { error, value } = catchEventSubmissionStatusSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const event = await getRepositories().catchEvents.updateSubmissionStatus(
          match[1],
          auth.user.id,
          match[2],
          value.status
        );
        if (!event) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }
        return json({ success: true, data: event, message: 'Submission updated successfully' });
      } catch (error) {
        console.error('Error updating catch event submission:', error);
        return json({ success: false, message: 'Failed to update submission' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)\/submissions\/([^/]+)$/);
    if (request.method === 'PUT' && match) {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const event = await getRepositories().catchEvents.getEventById(match[1]);
        if (!event) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        const body = await readJson(request);
        const { error, value } = catchEventSubmissionUpdateSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const validation = validateCatchEventSubmissionPayload(value, event);
        if (validation.errors.length > 0) {
          return json({
            success: false,
            message: validation.errors.join('; '),
            errors: validation.errors,
          }, { status: 400 });
        }

        const updatedEvent = await getRepositories().catchEvents.updateSubmission(
          match[1],
          auth.user.id,
          match[2],
          {
            ...value,
            catchUtc: validation.catchUtc,
            score: validation.score,
            status: validation.status,
            flags: validation.flags,
          }
        );
        if (!updatedEvent) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        return json({ success: true, data: updatedEvent, message: 'Submission updated successfully' });
      } catch (error) {
        console.error('Error updating catch event submission:', error);
        return json({ success: false, message: 'Failed to update submission' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)\/submissions$/);
    if (request.method === 'POST' && match) {
      try {
        const event = await getRepositories().catchEvents.getEventById(match[1]);
        if (!event) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }
        if (event.submissionsClosed) {
          return json({ success: false, message: 'Submissions are closed for this event.' }, { status: 403 });
        }

        const body = await readJson(request);
        const { error, value } = catchEventSubmissionSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const validation = validateCatchEventSubmissionPayload(value, event);
        if (validation.errors.length > 0) {
          return json({
            success: false,
            message: validation.errors.join('; '),
            errors: validation.errors,
          }, { status: 400 });
        }

        const submissionId = crypto.randomUUID();
        const screenshots = await storeCatchEventScreenshots(
          env,
          match[1],
          submissionId,
          value.screenshots,
          request.url
        );
        const result = await getRepositories().catchEvents.upsertSubmission(match[1], {
          ...value,
          catchUtc: validation.catchUtc,
          score: validation.score,
          status: validation.status,
          flags: validation.flags,
        }, screenshots);

        return json({
          success: true,
          data: result.submission,
          replaced: result.replaced,
          message: result.replaced ? 'Submission replaced successfully' : 'Submission created successfully',
        }, { status: result.replaced ? 200 : 201 });
      } catch (error) {
        console.error('Error submitting catch event entry:', error);
        return json({
          success: false,
          message: error.statusCode === 503
            ? error.message
            : 'Failed to submit catch event entry',
        }, { status: error.statusCode || 500 });
      }
    }

    match = pathname.match(/^\/api\/catch-events\/([^/]+)$/);
    if (request.method === 'GET' && match) {
      try {
        const authenticatedUser = await getAuthenticatedUser(request, env, getRepositories());
        const event = await getRepositories().catchEvents.getEventById(match[1], {
          includeSubmissions: true,
        });
        if (!event) {
          return json({ success: false, message: 'Catch event not found' }, { status: 404 });
        }

        const access = authenticatedUser?.id && getRepositories().catchEvents.getEventAccess
          ? await getRepositories().catchEvents.getEventAccess(match[1], authenticatedUser.id)
          : {
              isOwner: Boolean(authenticatedUser?.id && authenticatedUser.id === event.ownerUserId),
              canManage: Boolean(authenticatedUser?.id && authenticatedUser.id === event.ownerUserId),
            };
        const isOwner = Boolean(access?.isOwner);
        const canManage = Boolean(access?.canManage);
        if (!event.isLeaderboardPublished && !canManage) {
          return json({
            success: true,
            data: {
              ...event,
              submissions: [],
              leaderboardHidden: true,
            },
          });
        }

        return json({
          success: true,
          data: isOwner
            ? await getRepositories().catchEvents.getEventById(match[1], {
                includeSubmissions: true,
                includeCollaborators: true,
              })
            : event,
        });
      } catch (error) {
        console.error('Error fetching catch event:', error);
        return json({ success: false, message: 'Failed to fetch catch event' }, { status: 500 });
      }
    }

  return null;
}

module.exports = { handleCatchEventsRoutes };
