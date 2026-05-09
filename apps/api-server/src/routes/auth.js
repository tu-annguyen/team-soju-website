const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const axios = require('axios');
const Joi = require('joi');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const {
  clearAuthCookie,
  getJwtSecret,
  getTokenFromRequest,
  setAuthCookie,
  signUserToken,
  verifyUserToken,
} = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../services/email');

const router = express.Router();

const passwordRounds = 12;
const discordScopes = ['identify', 'email'];
const passwordResetExpiresInMinutes = 60;
const passwordResetTokenBytes = 32;
const passwordResetSentMessage = 'If an account uses that email, a reset link has been sent.';

const ignSchema = Joi.string().trim().min(1).max(50).required();

const registerSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).lowercase().max(254).required(),
  password: Joi.string().min(8).max(128).required(),
  ign: ignSchema,
});

const loginSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).lowercase().max(254).required(),
  password: Joi.string().min(1).max(128).required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).lowercase().max(254).required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().trim().min(32).max(256).required(),
  password: Joi.string().min(8).max(128).required(),
});

const discordStartSchema = Joi.object({
  mode: Joi.string().valid('login', 'register').default('login'),
  ign: Joi.string().trim().max(50).allow('', null),
  returnTo: Joi.string().trim().max(200).allow('', null),
});

function getWebAppUrl() {
  return (process.env.WEB_APP_URL || process.env.FRONTEND_URL || 'http://localhost:4321').replace(/\/+$/, '');
}

function getDiscordRedirectUri() {
  const apiOrigin = (process.env.API_ORIGIN || process.env.API_BASE_URL || 'http://localhost:3001')
    .replace(/\/api\/?$/, '')
    .replace(/\/+$/, '');

  return process.env.DISCORD_REDIRECT_URI || `${apiOrigin}/api/auth/discord/callback`;
}

function getDiscordConfig() {
  const config = {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: getDiscordRedirectUri(),
  };

  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    const error = new Error('Discord OAuth is not configured.');
    error.publicMessage = 'Discord sign-in is not configured yet.';
    throw error;
  }

  return config;
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

function buildWebRedirect(pathname = '/auth', params = {}) {
  const url = new URL(pathname, getWebAppUrl());

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

function generatePasswordResetToken() {
  return crypto.randomBytes(passwordResetTokenBytes).toString('hex');
}

function hashPasswordResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getPasswordResetUrl(token) {
  const url = new URL('/auth', getWebAppUrl());
  url.searchParams.set('resetToken', token);
  return url.toString();
}

function isPasswordResetExpired(expiresAt) {
  const expiresAtMs = new Date(expiresAt).getTime();

  return !Number.isFinite(expiresAtMs) || expiresAtMs < Date.now();
}

function getDiscordScopeParam() {
  return discordScopes.map(encodeURIComponent).join('%20');
}

function buildState(payload) {
  return jwt.sign(
    {
      type: 'discord_oauth_state',
      mode: payload.mode,
      ign: payload.ign || null,
      returnTo: sanitizeReturnTo(payload.returnTo),
    },
    getJwtSecret(),
    { expiresIn: '10m' }
  );
}

function verifyState(state) {
  const decoded = jwt.verify(state, getJwtSecret());

  if (decoded?.type !== 'discord_oauth_state') {
    throw new Error('Invalid Discord OAuth state.');
  }

  return {
    mode: decoded.mode === 'register' ? 'register' : 'login',
    ign: decoded.ign || null,
    returnTo: sanitizeReturnTo(decoded.returnTo),
  };
}

function getDuplicateMessage(error) {
  if (error.code !== '23505') {
    return null;
  }

  const detail = `${error.constraint || ''} ${error.detail || ''}`.toLowerCase();

  if (detail.includes('ign')) {
    return 'That IGN is already in use.';
  }

  if (detail.includes('email')) {
    return 'An account with that email already exists.';
  }

  return 'An account with that email or IGN already exists.';
}

async function signInUser(res, user, statusCode = 200, message = 'Signed in successfully.') {
  const loggedInUser = await User.recordLogin(user.id);
  const safeUser = User.toSafeUser(loggedInUser || user);
  const token = signUserToken(safeUser);

  setAuthCookie(res, token);

  return res.status(statusCode).json({
    success: true,
    data: safeUser,
    message,
  });
}

async function exchangeDiscordCode(code) {
  const { clientId, clientSecret, redirectUri } = getDiscordConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const response = await axios.post('https://discord.com/api/oauth2/token', body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return response.data;
}

async function fetchDiscordUser(accessToken) {
  const response = await axios.get('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
}

router.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details,
      });
    }

    const passwordHash = await bcrypt.hash(value.password, passwordRounds);
    const user = await User.createWithPassword({
      email: value.email,
      passwordHash,
      ign: value.ign,
    });

    return signInUser(res, user, 201, 'Account created successfully.');
  } catch (error) {
    const duplicateMessage = getDuplicateMessage(error);

    if (duplicateMessage) {
      return res.status(409).json({
        success: false,
        message: duplicateMessage,
      });
    }

    console.error('Error registering user:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create account',
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details,
      });
    }

    const user = await User.findByEmail(value.email);
    const passwordMatches = user?.password_hash
      ? await bcrypt.compare(value.password, user.password_hash)
      : false;

    if (!user || !passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    return signInUser(res, user);
  } catch (error) {
    console.error('Error signing in user:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sign in',
    });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { error, value } = forgotPasswordSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details,
      });
    }

    const user = await User.findByEmail(value.email);

    if (user) {
      const token = generatePasswordResetToken();
      const expiresAt = new Date(Date.now() + (passwordResetExpiresInMinutes * 60 * 1000));

      await User.setPasswordResetToken(user.id, {
        tokenHash: hashPasswordResetToken(token),
        expiresAt,
      });

      try {
        await sendPasswordResetEmail({
          to: user.email,
          resetUrl: getPasswordResetUrl(token),
          expiresInMinutes: passwordResetExpiresInMinutes,
          ign: user.ign,
        });
      } catch (sendError) {
        await User.clearPasswordResetToken(user.id).catch((clearError) => {
          console.error('Error clearing failed password reset token:', clearError);
        });
        throw sendError;
      }
    }

    return res.json({
      success: true,
      message: passwordResetSentMessage,
    });
  } catch (error) {
    console.error('Error requesting password reset:', error);
    return res.status(error.publicMessage ? 503 : 500).json({
      success: false,
      message: error.publicMessage || 'Failed to request password reset',
    });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { error, value } = resetPasswordSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details,
      });
    }

    const tokenHash = hashPasswordResetToken(value.token);
    const user = await User.findByPasswordResetTokenHash(tokenHash);

    if (!user || isPasswordResetExpired(user.password_reset_expires_at)) {
      if (user) {
        await User.clearPasswordResetToken(user.id);
      }

      return res.status(400).json({
        success: false,
        message: 'That password reset link is invalid or expired.',
      });
    }

    const passwordHash = await bcrypt.hash(value.password, passwordRounds);
    const updatedUser = await User.updatePassword(user.id, passwordHash);

    return signInUser(res, updatedUser || user, 200, 'Password reset successfully.');
  } catch (error) {
    console.error('Error resetting password:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password',
    });
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({
    success: true,
    message: 'Signed out successfully.',
  });
});

router.get('/me', async (req, res) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.json({
      success: true,
      data: null,
    });
  }

  try {
    const decoded = verifyUserToken(token);
    const user = await User.findById(decoded.sub);

    if (!user) {
      clearAuthCookie(res);
      return res.json({
        success: true,
        data: null,
      });
    }

    return res.json({
      success: true,
      data: User.toSafeUser(user),
    });
  } catch {
    clearAuthCookie(res);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session.',
    });
  }
});

router.get('/discord', (req, res) => {
  try {
    const { error, value } = discordStartSchema.validate(req.query);

    if (error) {
      return res.redirect(buildWebRedirect('/auth', { error: 'Invalid Discord sign-in request.' }));
    }

    if (value.mode === 'register' && !value.ign) {
      return res.redirect(buildWebRedirect('/auth', { error: 'Enter your IGN before continuing with Discord.' }));
    }

    const { clientId, redirectUri } = getDiscordConfig();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: buildState(value),
    });

    return res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}&scope=${getDiscordScopeParam()}`);
  } catch (error) {
    console.error('Error starting Discord OAuth:', error);
    return res.redirect(buildWebRedirect('/auth', {
      error: error.publicMessage || 'Unable to start Discord sign-in.',
    }));
  }
});

router.get('/discord/callback', async (req, res) => {
  try {
    if (req.query.error) {
      return res.redirect(buildWebRedirect('/auth', { error: 'Discord sign-in was cancelled.' }));
    }

    if (!req.query.code || !req.query.state) {
      return res.redirect(buildWebRedirect('/auth', { error: 'Discord sign-in did not return the expected data.' }));
    }

    const state = verifyState(req.query.state);
    const token = await exchangeDiscordCode(req.query.code);
    const discordUser = await fetchDiscordUser(token.access_token);

    if (!discordUser.email) {
      return res.redirect(buildWebRedirect('/auth', { error: 'Discord did not return an email address.' }));
    }

    if (discordUser.verified === false) {
      return res.redirect(buildWebRedirect('/auth', { error: 'Verify your Discord email before signing in.' }));
    }

    let user = await User.findByDiscordId(discordUser.id);

    if (!user) {
      const userByEmail = await User.findByEmail(discordUser.email);

      if (userByEmail) {
        user = await User.attachDiscord(userByEmail.id, discordUser);
      } else if (state.mode === 'register' && state.ign) {
        user = await User.createWithDiscord({
          email: discordUser.email,
          ign: state.ign,
          discord: discordUser,
        });
      } else {
        return res.redirect(buildWebRedirect('/auth', {
          mode: 'register',
          error: 'No Team Soju account is linked to that Discord account yet.',
        }));
      }
    }

    const loggedInUser = await User.recordLogin(user.id);
    const safeUser = User.toSafeUser(loggedInUser || user);

    setAuthCookie(res, signUserToken(safeUser));
    return res.redirect(buildWebRedirect(state.returnTo, { status: 'signed-in' }));
  } catch (error) {
    const duplicateMessage = getDuplicateMessage(error);

    if (duplicateMessage) {
      return res.redirect(buildWebRedirect('/auth', { error: duplicateMessage }));
    }

    console.error('Error completing Discord OAuth:', error);
    return res.redirect(buildWebRedirect('/auth', { error: 'Unable to complete Discord sign-in.' }));
  }
});

module.exports = router;
