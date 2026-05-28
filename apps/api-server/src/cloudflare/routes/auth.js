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

async function handleAuthRoutes(context) {
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

    if (request.method === 'POST' && pathname === '/api/auth/register') {
      try {
        const body = await readJson(request);
        const { error, value } = registerSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        if (isIgnBlacklisted(value.ign)) {
          return json({
            success: false,
            message: getBlacklistedIgnMessage(),
          }, { status: 400 });
        }

        const verificationToken = randomHex(32);
        const user = await getRepositories().users.createWithPassword({
          email: value.email,
          passwordHash: await derivePasswordHash(value.password),
          ign: value.ign,
          verificationTokenHash: await sha256Hex(verificationToken),
          verificationExpiresAt: new Date(Date.now() + (emailVerificationExpiresInMinutes * 60 * 1000)),
        });

        try {
          await sendEmail(fetchImpl, env, buildEmailVerificationMessage({
            to: user.email,
            verificationUrl: getEmailVerificationUrl(env, verificationToken),
            expiresInMinutes: emailVerificationExpiresInMinutes,
            ign: user.ign,
          }));
        } catch (sendError) {
          await getRepositories().users.deleteById(user.id).catch((deleteError) => {
            console.error('Error deleting unverified user after email failure:', deleteError);
          });
          throw sendError;
        }

        return json({
          success: true,
          data: null,
          message: emailVerificationSentMessage,
        }, { status: 201 });
      } catch (error) {
        const duplicateMessage = duplicateAuthMessage(error);
        if (duplicateMessage) {
          return json({ success: false, message: duplicateMessage }, { status: 409 });
        }

        console.error('Error registering user:', error);
        return json({
          success: false,
          message: error.publicMessage || 'Failed to create account',
        }, { status: error.publicMessage ? 503 : 500 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/auth/login') {
      try {
        const body = await readJson(request);
        const { error, value } = loginSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const user = await getRepositories().users.findByEmail(value.email);
        if (user?.password_hash?.startsWith('$2')) {
          return json({
            success: false,
            message: passwordMigrationMessage,
          }, { status: 403 });
        }

        const passwordMatches = user?.password_hash
          ? await verifyPassword(value.password, user.password_hash)
          : false;

        if (!user || !passwordMatches) {
          return json({
            success: false,
            message: 'Invalid email or password',
          }, { status: 401 });
        }

        if (!user.email_verified_at) {
          try {
            await issueEmailVerification(fetchImpl, env, getRepositories(), user);
          } catch (sendError) {
            console.error('Error resending verification email:', sendError);
            return json({
              success: false,
              message: sendError.publicMessage || 'Failed to send verification email',
            }, { status: sendError.publicMessage ? 503 : 500 });
          }

          return json({
            success: false,
            message: 'Verify your email before signing in. We sent you a new verification link.',
          }, { status: 403 });
        }

        return signInUser(env, getRepositories(), user);
      } catch (error) {
        console.error('Error signing in user:', error);
        return json({ success: false, message: 'Failed to sign in' }, { status: 500 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/auth/discord') {
      try {
        const { error, value } = discordStartSchema.validate(Object.fromEntries(url.searchParams.entries()));
        if (error) {
          return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Invalid Discord sign-in request.' }), 302);
        }

        if (value.mode === 'register' && !value.ign) {
          return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Enter your IGN before continuing with Discord.' }), 302);
        }

        if (value.mode === 'register' && value.ign && isIgnBlacklisted(value.ign)) {
          return Response.redirect(buildWebRedirect(env, '/auth', { error: getBlacklistedIgnMessage() }), 302);
        }

        let userId = null;
        if (value.mode === 'connect') {
          const auth = await requireUser(request, env, getRepositories());
          if (auth.response) {
            return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Sign in before connecting Discord.' }), 302);
          }
          userId = auth.user.id;
        }

        const { clientId, redirectUri } = getDiscordConfig(env);
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          state: await buildState({ ...value, userId }, env),
        });

        return Response.redirect(`https://discord.com/oauth2/authorize?${params.toString()}&scope=${getDiscordScopeParam()}`, 302);
      } catch (error) {
        console.error('Error starting Discord OAuth:', error);
        return Response.redirect(buildWebRedirect(env, '/auth', {
          error: error.publicMessage || 'Unable to start Discord sign-in.',
        }), 302);
      }
    }

    if (request.method === 'GET' && pathname === '/api/auth/discord/callback') {
      try {
        if (url.searchParams.get('error')) {
          return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Discord sign-in was cancelled.' }), 302);
        }

        const code = url.searchParams.get('code');
        const rawState = url.searchParams.get('state');
        if (!code || !rawState) {
          return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Discord sign-in did not return the expected data.' }), 302);
        }

        const state = await verifyState(rawState, env);
        if (state.mode === 'register' && state.ign && isIgnBlacklisted(state.ign)) {
          return Response.redirect(buildWebRedirect(env, '/auth', { error: getBlacklistedIgnMessage() }), 302);
        }

        const token = await exchangeDiscordCode(fetchImpl, env, code);
        const discordUser = await fetchDiscordUser(fetchImpl, token.access_token);

        if (!discordUser.email) {
          return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Discord did not return an email address.' }), 302);
        }

        if (discordUser.verified === false) {
          return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Verify your Discord email before signing in.' }), 302);
        }

        let user = await getRepositories().users.findByDiscordId(discordUser.id);

        if (state.mode === 'connect') {
          if (!state.userId) {
            return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Discord connection session expired. Please try again.' }), 302);
          }

          const currentUser = await getRepositories().users.findById(state.userId);
          if (!currentUser) {
            return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Sign in before connecting Discord.' }), 302);
          }

          if (user && user.id !== currentUser.id) {
            return Response.redirect(buildWebRedirect(env, '/auth', { error: 'That Discord account is already connected to another Team Soju account.' }), 302);
          }

          user = user?.id === currentUser.id
            ? user
            : await getRepositories().users.attachDiscord(currentUser.id, discordUser);
        } else if (!user) {
          const userByEmail = await getRepositories().users.findByEmail(discordUser.email);
          if (userByEmail) {
            user = await getRepositories().users.attachDiscord(userByEmail.id, discordUser);
          } else if (state.mode === 'register' && state.ign) {
            user = await getRepositories().users.createWithDiscord({
              email: discordUser.email,
              ign: state.ign,
              discord: discordUser,
            });
          } else {
            return Response.redirect(buildWebRedirect(env, '/auth', {
              mode: 'register',
              error: 'No Team Soju account is linked to that Discord account yet.',
            }), 302);
          }
        }

        const loggedInUser = await getRepositories().users.recordLogin(user.id);
        const safeUser = getRepositories().users.toSafeUser(loggedInUser || user);
        const sessionToken = await signUserToken(safeUser, env);
        const handoffToken = await buildDiscordHandoffToken(safeUser, env);

        return redirect(buildDiscordHandoffRedirect(env, state.returnTo, handoffToken), {
          headers: { 'set-cookie': setAuthCookie(sessionToken, env) },
        });
      } catch (error) {
        const duplicateMessage = duplicateAuthMessage(error);
        if (duplicateMessage) {
          return Response.redirect(buildWebRedirect(env, '/auth', { error: duplicateMessage }), 302);
        }

        console.error('Error completing Discord OAuth:', error);
        return Response.redirect(buildWebRedirect(env, '/auth', { error: 'Unable to complete Discord sign-in.' }), 302);
      }
    }

    if (request.method === 'POST' && pathname === '/api/auth/discord/session') {
      try {
        const body = await readJson(request);
        const { error, value } = discordSessionSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const session = await verifyDiscordHandoffToken(value.token, env);
        const user = await getRepositories().users.findById(session.sub);
        if (!user) {
          return json({
            success: false,
            message: 'Discord sign-in session expired. Please try again.',
          }, { status: 401 });
        }

        const safeUser = getRepositories().users.toSafeUser(user);
        const token = await signUserToken(safeUser, env);
        return json({
          success: true,
          data: safeUser,
          message: 'Signed in successfully.',
        }, {
          headers: { 'set-cookie': setAuthCookie(token, env) },
        });
      } catch {
        return json({
          success: false,
          message: 'Discord sign-in session expired. Please try again.',
        }, { status: 401 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/auth/me') {
      const token = getTokenFromRequest(request, env);

      if (!token) {
        return json({
          success: true,
          data: null,
        });
      }

      try {
        const decoded = await verifyUserToken(token, env);
        const user = await getRepositories().users.findById(decoded.sub);

        if (!user) {
          if (env.LEGACY_API_BASE_URL && shouldNormalizeLegacyCookie(request, env)) {
            return maybeProxyLegacyRequest(request, env, ctx);
          }

          return json({
            success: true,
            data: null,
          }, {
            headers: {
              'set-cookie': clearAuthCookie(env),
            },
          });
        }

        return json({
          success: true,
          data: getRepositories().users.toSafeUser(user),
        });
      } catch {
        return json({
          success: false,
          message: 'Invalid or expired session.',
        }, {
          status: 401,
          headers: {
            'set-cookie': clearAuthCookie(env),
          },
        });
      }
    }

    if (request.method === 'POST' && pathname === '/api/auth/logout') {
      return json({
        success: true,
        message: 'Signed out successfully.',
      }, {
        headers: { 'set-cookie': clearAuthCookie(env) },
      });
    }

    if (request.method === 'POST' && pathname === '/api/auth/forgot-password') {
      try {
        const body = await readJson(request);
        const { error, value } = forgotPasswordSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const user = await getRepositories().users.findByEmail(value.email);
        const emailHash = await sha256Hex(value.email);
        console.log('Password reset request processed:', {
          emailHashPrefix: emailHash.slice(0, 8),
          userFound: Boolean(user),
        });
        if (user) {
          const token = randomHex(32);
          const tokenHash = await sha256Hex(token);
          const expiresAt = new Date(Date.now() + (passwordResetExpiresInMinutes * 60 * 1000));
          await getRepositories().users.setPasswordResetToken(user.id, {
            tokenHash,
            expiresAt,
          });
          console.log('Password reset token stored:', {
            userId: user.id,
            tokenHashPrefix: tokenHash.slice(0, 8),
            expiresAt: expiresAt.toISOString(),
          });

          try {
            await sendEmail(fetchImpl, env, buildPasswordResetMessage({
              to: user.email,
              resetUrl: getPasswordResetUrl(env, token),
              expiresInMinutes: passwordResetExpiresInMinutes,
              ign: user.ign,
            }));
          } catch (sendError) {
            await getRepositories().users.clearPasswordResetToken(user.id).catch((clearError) => {
              console.error('Error clearing failed password reset token:', clearError);
            });
            throw sendError;
          }
        }

        return json({ success: true, message: passwordResetSentMessage });
      } catch (error) {
        console.error('Error requesting password reset:', error);
        return json({
          success: false,
          message: error.publicMessage || 'Failed to request password reset',
        }, { status: error.publicMessage ? 503 : 500 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/auth/reset-password') {
      try {
        const body = await readJson(request);
        const { error, value } = resetPasswordSchema.validate(body);
        if (error) {
          console.warn('Password reset validation failed:', error.details.map((detail) => detail.message));
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const tokenHash = await sha256Hex(value.token);
        const user = await getRepositories().users.findByPasswordResetTokenHash(tokenHash);
        if (!user || isExpired(user.password_reset_expires_at)) {
          console.warn('Password reset token rejected:', {
            tokenHashPrefix: tokenHash.slice(0, 8),
            userFound: Boolean(user),
            expiresAt: user?.password_reset_expires_at || null,
            workerNow: new Date().toISOString(),
          });
          if (user) {
            await getRepositories().users.clearPasswordResetToken(user.id);
          }
          return json({
            success: false,
            message: 'That password reset link is invalid or expired.',
          }, { status: 400 });
        }

        const updatedUser = await getRepositories().users.updatePassword(user.id, await derivePasswordHash(value.password));
        return signInUser(env, getRepositories(), updatedUser || user, 200, 'Password reset successfully.');
      } catch (error) {
        console.error('Error resetting password:', error);
        return json({ success: false, message: 'Failed to reset password' }, { status: 500 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/auth/change-email') {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const body = await readJson(request);
        const { error, value } = changeEmailSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const normalizedEmail = getRepositories().users.normalizeEmail(value.email);
        if (normalizedEmail === auth.user.email) {
          return json({
            success: false,
            message: 'That is already your current email address.',
          }, { status: 400 });
        }

        const verificationToken = randomHex(32);
        const updatedUser = await getRepositories().users.updateEmail(auth.user.id, {
          email: normalizedEmail,
          tokenHash: await sha256Hex(verificationToken),
          expiresAt: new Date(Date.now() + (emailVerificationExpiresInMinutes * 60 * 1000)),
        });

        await sendEmail(fetchImpl, env, buildEmailVerificationMessage({
          to: normalizedEmail,
          verificationUrl: getEmailVerificationUrl(env, verificationToken),
          expiresInMinutes: emailVerificationExpiresInMinutes,
          ign: auth.user.ign,
        }));

        const safeUser = getRepositories().users.toSafeUser(updatedUser || auth.user);
        const token = await signUserToken(safeUser, env);
        return json({
          success: true,
          data: safeUser,
          message: 'Email updated. Check your new inbox to verify it.',
        }, {
          headers: { 'set-cookie': setAuthCookie(token, env) },
        });
      } catch (error) {
        const duplicateMessage = duplicateAuthMessage(error);
        if (duplicateMessage) {
          return json({ success: false, message: duplicateMessage }, { status: 409 });
        }

        console.error('Error changing email:', error);
        return json({
          success: false,
          message: error.publicMessage || 'Failed to change email',
        }, { status: error.publicMessage ? 503 : 500 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/auth/change-password') {
      const auth = await requireUser(request, env, getRepositories());
      if (auth.response) return auth.response;

      try {
        const body = await readJson(request);
        const { error, value } = changePasswordSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        if (auth.user.password_hash) {
          const passwordMatches = await verifyPassword(value.currentPassword || '', auth.user.password_hash);
          if (!passwordMatches) {
            return json({
              success: false,
              message: 'Current password is incorrect.',
            }, { status: 401 });
          }
        }

        const updatedUser = await getRepositories().users.updatePassword(auth.user.id, await derivePasswordHash(value.newPassword));
        return json({
          success: true,
          data: getRepositories().users.toSafeUser(updatedUser || auth.user),
          message: auth.user.password_hash
            ? 'Password updated successfully.'
            : 'Password added successfully.',
        });
      } catch (error) {
        console.error('Error changing password:', error);
        return json({ success: false, message: 'Failed to change password' }, { status: 500 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/auth/verify-email') {
      const { error, value } = verifyEmailSchema.validate(Object.fromEntries(url.searchParams.entries()));
      if (error) {
        return Response.redirect(buildWebRedirect(env, '/auth', {
          error: 'That verification link is invalid or expired.',
        }), 302);
      }

      try {
        const tokenHash = await sha256Hex(value.token);
        const user = await getRepositories().users.findByEmailVerificationTokenHash(tokenHash);
        if (!user || isExpired(user.email_verification_expires_at)) {
          return Response.redirect(buildWebRedirect(env, '/auth', {
            error: 'That verification link is invalid or expired.',
          }), 302);
        }

        await getRepositories().users.markEmailVerified(user.id);
        return Response.redirect(buildWebRedirect(env, '/auth', {
          mode: 'login',
          status: 'email-verified',
        }), 302);
      } catch (error) {
        console.error('Error verifying email:', error);
        return Response.redirect(buildWebRedirect(env, '/auth', {
          error: 'Unable to verify your email.',
        }), 302);
      }
    }

  return null;
}

module.exports = { handleAuthRoutes };
