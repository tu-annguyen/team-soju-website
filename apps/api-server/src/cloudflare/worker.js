const {
  buildShinyFilters,
  enrichShinyPayloadWithVariants,
  memberSchema,
  shinySchema,
  updateMemberSchema,
  updateShinySchema,
} = require('./contracts');
const Joi = require('joi');
const {
  authenticateBotRequest,
  clearAuthCookie,
  generateBotToken,
  getTokenFromRequest,
  setAuthCookie,
  signJwt,
  signUserToken,
  verifyJwt,
  verifyUserToken,
} = require('./auth');
const { createRepositories } = require('./repositories');
const { buildCorsHeaders, empty, json, readJson, withStandardHeaders } = require('./http');
const { FeebasRuleError, getLocationConfig } = require('../utils/feebas');
const { isIgnBlacklisted } = require('../utils/ignModeration');

const passwordResetExpiresInMinutes = 60;
const passwordResetSentMessage = 'If an account uses that email, a reset link has been sent.';
const emailVerificationExpiresInMinutes = 24 * 60;
const emailVerificationSentMessage = 'Account created. Check your email to verify it before signing in.';
const discordScopes = ['identify', 'email'];
const passwordMigrationMessage = 'We upgraded account security during the Cloudflare migration. Please reset your password to continue.';

const updateFeebasTileSchema = Joi.object({
  status: Joi.string().valid('unchecked', 'checked', 'pending', 'confirmed').required(),
  actorFingerprint: Joi.string().trim().min(8).max(120).required(),
  actorName: Joi.string().trim().allow('', null).max(40).optional(),
});
const feebasActorFingerprintSchema = Joi.string().trim().min(8).max(120).optional();
const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/[0-9]/, 'number')
  .pattern(/[^A-Za-z0-9]/, 'special character')
  .required()
  .messages({
    'string.pattern.name': 'Password must include at least one number and one special character.',
  });
const forgotPasswordSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).lowercase().max(254).required(),
});
const registerSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).lowercase().max(254).required(),
  password: passwordSchema,
  ign: Joi.string().trim().min(1).max(50).required(),
});
const loginSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).lowercase().max(254).required(),
  password: Joi.string().min(1).max(128).required(),
});
const resetPasswordSchema = Joi.object({
  token: Joi.string().trim().min(32).max(256).required(),
  password: passwordSchema,
});
const changeEmailSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).lowercase().max(254).required(),
});
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().allow('', null).max(128),
  newPassword: passwordSchema,
});
const verifyEmailSchema = Joi.object({
  token: Joi.string().trim().min(32).max(256).required(),
});
const discordStartSchema = Joi.object({
  mode: Joi.string().valid('login', 'register', 'connect').default('login'),
  ign: Joi.string().trim().max(50).allow('', null),
  returnTo: Joi.string().trim().max(200).allow('', null),
});

function getEnvUrl(env, ...keys) {
  const value = keys.map((key) => env[key]).find(Boolean);
  return String(value || 'http://localhost:4321').replace(/\/+$/, '');
}

function getWebAppUrl(env) {
  return getEnvUrl(env, 'WEB_APP_URL', 'FRONTEND_URL');
}

function getApiOrigin(env) {
  return String(env.API_ORIGIN || env.API_BASE_URL || 'http://localhost:3001')
    .replace(/\/api\/?$/, '')
    .replace(/\/+$/, '');
}

function getDiscordRedirectUri(env) {
  return env.DISCORD_REDIRECT_URI || `${getApiOrigin(env)}/api/auth/discord/callback`;
}

function getDiscordConfig(env) {
  const config = {
    clientId: env.DISCORD_CLIENT_ID,
    clientSecret: env.DISCORD_CLIENT_SECRET,
    redirectUri: getDiscordRedirectUri(env),
  };

  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    const error = new Error('Discord OAuth is not configured.');
    error.publicMessage = 'Discord sign-in is not configured yet.';
    throw error;
  }

  return config;
}

function getEmailVerificationUrl(env, token) {
  const redirectUri = getDiscordRedirectUri(env);
  const url = new URL('/api/auth/verify-email', redirectUri);
  url.searchParams.set('token', token);
  return url.toString();
}

function getPasswordResetUrl(env, token) {
  const url = new URL('/auth', getWebAppUrl(env));
  url.searchParams.set('resetToken', token);
  return url.toString();
}

function buildWebRedirect(env, pathname = '/auth', params = {}) {
  const url = new URL(pathname, getWebAppUrl(env));
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

function redirect(location, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('location', location);
  return new Response(null, {
    status: init.status || 302,
    headers,
  });
}

function sanitizeReturnTo(returnTo) {
  if (!returnTo || typeof returnTo !== 'string') {
    return '/';
  }

  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return '/';
  }

  return returnTo;
}

function getDiscordScopeParam() {
  return discordScopes.map(encodeURIComponent).join('%20');
}

function getBlacklistedIgnMessage() {
  return 'That IGN is not allowed. Please choose a different in-game name.';
}

async function buildState(payload, env) {
  return signJwt(
    {
      type: 'discord_oauth_state',
      mode: payload.mode,
      ign: payload.ign || null,
      userId: payload.userId || null,
      returnTo: sanitizeReturnTo(payload.returnTo),
    },
    env.JWT_SECRET,
    { expiresIn: '10m' }
  );
}

async function verifyState(state, env) {
  const decoded = await verifyJwt(state, env.JWT_SECRET);

  if (decoded?.type !== 'discord_oauth_state') {
    throw new Error('Invalid Discord OAuth state.');
  }

  return {
    mode: decoded.mode === 'register'
      ? 'register'
      : decoded.mode === 'connect'
        ? 'connect'
        : 'login',
    ign: decoded.ign || null,
    userId: decoded.userId || null,
    returnTo: sanitizeReturnTo(decoded.returnTo),
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPasswordResetMessage({ to, resetUrl, expiresInMinutes, ign }) {
  const displayName = ign ? ` ${ign}` : '';
  const escapedDisplayName = escapeHtml(displayName);
  const escapedResetUrl = escapeHtml(resetUrl);
  return {
    to,
    subject: 'Reset your Team Soju password',
    text: [
      `Hi${displayName},`,
      '',
      'Use this link to reset your Team Soju password:',
      resetUrl,
      '',
      `This link expires in ${expiresInMinutes} minutes.`,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: `
      <p>Hi${escapedDisplayName},</p>
      <p>Use this link to reset your Team Soju password:</p>
      <p><a href="${escapedResetUrl}">Reset your password</a></p>
      <p>This link expires in ${expiresInMinutes} minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  };
}

function buildEmailVerificationMessage({ to, verificationUrl, expiresInMinutes, ign }) {
  const displayName = ign ? ` ${ign}` : '';
  const escapedDisplayName = escapeHtml(displayName);
  const escapedVerificationUrl = escapeHtml(verificationUrl);
  return {
    to,
    subject: 'Verify your Team Soju email',
    text: [
      `Hi${displayName},`,
      '',
      'Use this link to verify your Team Soju email before signing in:',
      verificationUrl,
      '',
      `This link expires in ${expiresInMinutes} minutes.`,
      '',
      'If you did not create this account, you can ignore this email.',
    ].join('\n'),
    html: `
      <p>Hi${escapedDisplayName},</p>
      <p>Use this link to verify your Team Soju email before signing in:</p>
      <p><a href="${escapedVerificationUrl}">Verify your email</a></p>
      <p>This link expires in ${expiresInMinutes} minutes.</p>
      <p>If you did not create this account, you can ignore this email.</p>
    `,
  };
}

async function sendEmail(fetchImpl, env, message) {
  const provider = String(env.EMAIL_PROVIDER || (env.NODE_ENV === 'production' ? 'resend' : 'console')).trim().toLowerCase();
  if (provider === 'console') {
    if (env.NODE_ENV !== 'test') {
      console.log(`${message.subject} email for ${message.to}:\n${message.text}`);
    }
    return { provider: 'console' };
  }

  if (provider === 'resend') {
    if (!env.RESEND_API_KEY || !(env.EMAIL_FROM || env.RESEND_FROM)) {
      const error = new Error('Resend email is not configured.');
      error.publicMessage = 'Email delivery is not configured yet.';
      throw error;
    }

    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM || env.RESEND_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!response.ok) {
      const error = new Error('Resend email request failed.');
      error.publicMessage = 'Email delivery is not configured yet.';
      throw error;
    }
    return response.json();
  }

  if (provider === 'postmark') {
    if (!env.POSTMARK_SERVER_TOKEN || !(env.EMAIL_FROM || env.POSTMARK_FROM)) {
      const error = new Error('Postmark email is not configured.');
      error.publicMessage = 'Email delivery is not configured yet.';
      throw error;
    }

    const body = {
      From: env.EMAIL_FROM || env.POSTMARK_FROM,
      To: message.to,
      Subject: message.subject,
      TextBody: message.text,
      HtmlBody: message.html,
    };
    if (env.POSTMARK_MESSAGE_STREAM) {
      body.MessageStream = env.POSTMARK_MESSAGE_STREAM;
    }

    const response = await fetchImpl('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': env.POSTMARK_SERVER_TOKEN,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = new Error('Postmark email request failed.');
      error.publicMessage = 'Email delivery is not configured yet.';
      throw error;
    }
    return response.json();
  }

  const error = new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
  error.publicMessage = 'Email delivery is not configured yet.';
  throw error;
}

async function exchangeDiscordCode(fetchImpl, env, code) {
  const { clientId, clientSecret, redirectUri } = getDiscordConfig(env);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetchImpl('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error('Discord token exchange failed.');
  }

  return response.json();
}

async function fetchDiscordUser(fetchImpl, accessToken) {
  const response = await fetchImpl('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Discord user fetch failed.');
  }

  return response.json();
}

function getCrypto() {
  return globalThis.crypto || require('crypto').webcrypto;
}

function randomHex(byteLength) {
  const bytes = new Uint8Array(byteLength);
  getCrypto().getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value) {
  const digest = await getCrypto().subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function derivePasswordHash(password, saltHex = randomHex(16), iterations = 100000) {
  const salt = Uint8Array.from(saltHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
  const key = await getCrypto().subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await getCrypto().subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt,
    iterations,
  }, key, 256);
  const hashHex = Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `pbkdf2_sha256$${iterations}$${saltHex}$${hashHex}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash) return false;

  if (storedHash.startsWith('pbkdf2_sha256$')) {
    const [, iterations, saltHex, expectedHash] = storedHash.split('$');
    const actualHash = await derivePasswordHash(password, saltHex, Number(iterations));
    return actualHash.endsWith(`$${expectedHash}`);
  }

  return false;
}

function isExpired(expiresAt) {
  const expiresAtMs = new Date(expiresAt).getTime();
  return !Number.isFinite(expiresAtMs) || expiresAtMs < Date.now();
}

function duplicateAuthMessage(error) {
  const message = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  if (!message.includes('unique') && error?.code !== '23505') {
    return null;
  }
  if (message.includes('ign')) return 'That IGN is already in use.';
  if (message.includes('email')) return 'An account with that email already exists.';
  return 'An account with that email or IGN already exists.';
}

function isLocalhost(value) {
  try {
    const url = new URL(value);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function shouldNormalizeLegacyCookie(request, env) {
  return env.NODE_ENV !== 'production' || isLocalhost(request.url) || isLocalhost(env.API_ORIGIN || env.API_BASE_URL || '');
}

function normalizeLegacySetCookie(cookieHeader) {
  return cookieHeader
    .split(';')
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment.toLowerCase() !== 'secure' && !segment.toLowerCase().startsWith('samesite='))
    .concat('SameSite=Lax')
    .join('; ');
}

function createWorkerApp(options = {}) {
  const createRepos = options.createRepositories || createRepositories;
  const fetchImpl = options.fetch || fetch;

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
      '/api/auth/discord/callback',
    ]);

    return pathname === '/api/shinies/from-screenshot'
      || pathname === '/api/shinies/from-screenshot/async'
      || pathname.startsWith('/api/shinies/sprites/')
      || (pathname.startsWith('/api/auth/') && !workerAuthPaths.has(pathname))
      || /^\/api\/feebas\/[^/]+\/stream$/.test(pathname);
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
        return redirect(buildWebRedirect(env, state.returnTo, { status: 'signed-in' }), {
          headers: { 'set-cookie': setAuthCookie(await signUserToken(safeUser, env), env) },
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

    if (request.method === 'GET' && pathname === '/api/members') {
      try {
        const data = await getRepositories().members.findAll();
        return json({ success: true, data });
      } catch (error) {
        console.error('Error fetching members:', error);
        return json({ success: false, message: 'Failed to fetch team members' }, { status: 500 });
      }
    }

    let match = pathname.match(/^\/api\/members\/ign\/inactive\/(.+)$/);
    if (request.method === 'GET' && match) {
      try {
        const member = await getRepositories().members.findByIgnIncludingInactive(decodeURIComponent(match[1]));
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        if (member.is_active) {
          return json({ success: false, message: 'Team member is already active' }, { status: 400 });
        }
        return json({ success: true, data: member });
      } catch (error) {
        console.error('Error fetching member:', error);
        return json({ success: false, message: 'Failed to fetch team member' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/members\/ign\/(.+)$/);
    if (request.method === 'GET' && match) {
      try {
        const member = await getRepositories().members.findByIgn(decodeURIComponent(match[1]));
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        return json({ success: true, data: member });
      } catch (error) {
        console.error('Error fetching member:', error);
        return json({ success: false, message: 'Failed to fetch team member' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/members\/discord\/(.+)$/);
    if (request.method === 'GET' && match) {
      try {
        const member = await getRepositories().members.findByDiscordId(decodeURIComponent(match[1]));
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        return json({ success: true, data: member });
      } catch (error) {
        console.error('Error fetching member:', error);
        return json({ success: false, message: 'Failed to fetch team member' }, { status: 500 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/members') {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const body = await readJson(request);
        const { error, value } = memberSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const member = await getRepositories().members.create(value);
        return json({
          success: true,
          data: member,
          message: 'Team member created successfully',
        }, { status: 201 });
      } catch (error) {
        console.error('Error creating member:', error);
        if (error.code === '23505' || /UNIQUE constraint failed/i.test(error.message || '')) {
          return json({
            success: false,
            message: 'A member with this IGN or Discord ID already exists',
          }, { status: 409 });
        }
        return json({ success: false, message: 'Failed to create team member' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/members\/reactivate\/([^/]+)$/);
    if (request.method === 'PUT' && match) {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const member = await getRepositories().members.reactivate(match[1]);
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        return json({
          success: true,
          data: member,
          message: 'Team member reactivated successfully',
        });
      } catch (error) {
        console.error('Error reactivating member:', error);
        return json({ success: false, message: 'Failed to reactivate team member' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/members\/([^/]+)\/stats$/);
    if (request.method === 'GET' && match) {
      try {
        const stats = await getRepositories().members.getShinyStats(match[1]);
        return json({ success: true, data: stats });
      } catch (error) {
        console.error('Error fetching member stats:', error);
        return json({ success: false, message: 'Failed to fetch member statistics' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/members\/([^/]+)$/);
    if (request.method === 'GET' && match) {
      try {
        const member = await getRepositories().members.findById(match[1]);
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        return json({ success: true, data: member });
      } catch (error) {
        console.error('Error fetching member:', error);
        return json({ success: false, message: 'Failed to fetch team member' }, { status: 500 });
      }
    }

    if (request.method === 'PUT' && match) {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const body = await readJson(request);
        const { error, value } = updateMemberSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const member = await getRepositories().members.update(match[1], value);
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        return json({
          success: true,
          data: member,
          message: 'Team member updated successfully',
        });
      } catch (error) {
        console.error('Error updating member:', error);
        return json({ success: false, message: 'Failed to update team member' }, { status: 500 });
      }
    }

    if (request.method === 'DELETE' && match) {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const member = await getRepositories().members.delete(match[1]);
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        return json({
          success: true,
          message: 'Team member deactivated successfully',
        });
      } catch (error) {
        console.error('Error deleting member:', error);
        return json({ success: false, message: 'Failed to delete team member' }, { status: 500 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/shinies') {
      try {
        const data = await getRepositories().shinies.findAll(buildShinyFilters(url));
        return json({ success: true, data, count: data.length });
      } catch (error) {
        console.error('Error fetching shinies:', error);
        return json({ success: false, message: 'Failed to fetch team shinies' }, { status: 500 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/shinies/stats') {
      try {
        const data = await getRepositories().shinies.getStats();
        return json({ success: true, data });
      } catch (error) {
        console.error('Error fetching shiny stats:', error);
        return json({ success: false, message: 'Failed to fetch shiny statistics' }, { status: 500 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/shinies/leaderboard') {
      try {
        const limit = parseInt(url.searchParams.get('limit') || '10', 10);
        const data = await getRepositories().shinies.getTopTrainers(limit);
        return json({ success: true, data });
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return json({ success: false, message: 'Failed to fetch leaderboard' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/shinies\/([^/]+)$/);
    if (request.method === 'GET' && match) {
      try {
        const shiny = await getRepositories().shinies.findById(match[1]);
        if (!shiny) {
          return json({ success: false, message: 'Shiny not found' }, { status: 404 });
        }
        return json({ success: true, data: shiny });
      } catch (error) {
        console.error('Error fetching shiny:', error);
        return json({ success: false, message: 'Failed to fetch shiny' }, { status: 500 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/shinies') {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const body = await readJson(request);
        const { error, value } = shinySchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const shiny = await getRepositories().shinies.create(await enrichShinyPayloadWithVariants(value));
        return json({
          success: true,
          data: shiny,
          message: 'Shiny entry created successfully',
        }, { status: 201 });
      } catch (error) {
        console.error('Error creating shiny:', error);
        if (error.code === '23503' || /FOREIGN KEY constraint failed/i.test(error.message || '')) {
          return json({ success: false, message: 'Invalid trainer ID or Pokemon number' }, { status: 400 });
        }
        return json({ success: false, message: 'Failed to create shiny entry' }, { status: 500 });
      }
    }

    if (request.method === 'PUT' && match) {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const body = await readJson(request);
        const { error, value } = updateShinySchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const shiny = await getRepositories().shinies.update(match[1], await enrichShinyPayloadWithVariants(value));
        if (!shiny) {
          return json({ success: false, message: 'Shiny not found' }, { status: 404 });
        }
        return json({
          success: true,
          data: shiny,
          message: 'Shiny entry updated successfully',
        });
      } catch (error) {
        console.error('Error updating shiny:', error);
        return json({ success: false, message: 'Failed to update shiny entry' }, { status: 500 });
      }
    }

    if (request.method === 'DELETE' && match) {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const shiny = await getRepositories().shinies.delete(match[1]);
        if (!shiny) {
          return json({ success: false, message: 'Shiny not found' }, { status: 404 });
        }
        return json({
          success: true,
          data: shiny,
          message: 'Shiny entry deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting shiny:', error);
        return json({ success: false, message: 'Failed to delete shiny entry' }, { status: 500 });
      }
    }

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
  fetch: (...args) => createWorkerApp().fetch(...args),
};
