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
  requireUser,
  setAuthCookie,
  signUserToken,
  verifyUserToken,
} = require('../middleware/auth');
const {
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} = require('../services/email');
const { isIgnBlacklisted } = require('../utils/ignModeration');

const router = express.Router();

const passwordRounds = 12;
const discordScopes = ['identify', 'email'];
const passwordResetExpiresInMinutes = 60;
const passwordResetTokenBytes = 32;
const passwordResetSentMessage = 'If an account uses that email, a reset link has been sent.';
const emailVerificationExpiresInMinutes = 24 * 60;
const emailVerificationTokenBytes = 32;
const emailVerificationSentMessage = 'Account created. Check your email to verify it before signing in.';

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

const changeEmailSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).lowercase().max(254).required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().allow('', null).max(128),
  newPassword: Joi.string().min(8).max(128).required(),
});

const verifyEmailSchema = Joi.object({
  token: Joi.string().trim().min(32).max(256).required(),
});

const discordStartSchema = Joi.object({
  mode: Joi.string().valid('login', 'register', 'connect').default('login'),
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

function generateEmailVerificationToken() {
  return crypto.randomBytes(emailVerificationTokenBytes).toString('hex');
}

function hashEmailVerificationToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getPasswordResetUrl(token) {
  const url = new URL('/auth', getWebAppUrl());
  url.searchParams.set('resetToken', token);
  return url.toString();
}

function getEmailVerificationUrl(token) {
  const url = new URL('/api/auth/verify-email', getDiscordRedirectUri());
  url.searchParams.set('token', token);
  return url.toString();
}

function isPasswordResetExpired(expiresAt) {
  const expiresAtMs = new Date(expiresAt).getTime();

  return !Number.isFinite(expiresAtMs) || expiresAtMs < Date.now();
}

function isEmailVerificationExpired(expiresAt) {
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
      userId: payload.userId || null,
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

function getBlacklistedIgnMessage() {
  return 'That IGN is not allowed. Please choose a different in-game name.';
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

async function issueEmailVerification(user) {
  const token = generateEmailVerificationToken();
  const expiresAt = new Date(Date.now() + (emailVerificationExpiresInMinutes * 60 * 1000));

  await User.setEmailVerificationToken(user.id, {
    tokenHash: hashEmailVerificationToken(token),
    expiresAt,
  });

  await sendEmailVerificationEmail({
    to: user.email,
    verificationUrl: getEmailVerificationUrl(token),
    expiresInMinutes: emailVerificationExpiresInMinutes,
    ign: user.ign,
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

    if (isIgnBlacklisted(value.ign)) {
      return res.status(400).json({
        success: false,
        message: getBlacklistedIgnMessage(),
      });
    }

    const passwordHash = await bcrypt.hash(value.password, passwordRounds);
    const verificationToken = generateEmailVerificationToken();
    const verificationExpiresAt = new Date(Date.now() + (emailVerificationExpiresInMinutes * 60 * 1000));
    const user = await User.createWithPassword({
      email: value.email,
      passwordHash,
      ign: value.ign,
      verificationTokenHash: hashEmailVerificationToken(verificationToken),
      verificationExpiresAt,
    });

    try {
      await sendEmailVerificationEmail({
        to: user.email,
        verificationUrl: getEmailVerificationUrl(verificationToken),
        expiresInMinutes: emailVerificationExpiresInMinutes,
        ign: user.ign,
      });
    } catch (sendError) {
      await User.deleteById(user.id).catch((deleteError) => {
        console.error('Error deleting unverified user after email failure:', deleteError);
      });
      throw sendError;
    }

    return res.status(201).json({
      success: true,
      data: null,
      message: emailVerificationSentMessage,
    });
  } catch (error) {
    const duplicateMessage = getDuplicateMessage(error);

    if (duplicateMessage) {
      return res.status(409).json({
        success: false,
        message: duplicateMessage,
      });
    }

    console.error('Error registering user:', error);
    return res.status(error.publicMessage ? 503 : 500).json({
      success: false,
      message: error.publicMessage || 'Failed to create account',
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

    if (!user.email_verified_at) {
      try {
        await issueEmailVerification(user);
      } catch (sendError) {
        console.error('Error resending verification email:', sendError);
        return res.status(sendError.publicMessage ? 503 : 500).json({
          success: false,
          message: sendError.publicMessage || 'Failed to send verification email',
        });
      }

      return res.status(403).json({
        success: false,
        message: 'Verify your email before signing in. We sent you a new verification link.',
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

router.post('/change-email', requireUser, async (req, res) => {
  try {
    const { error, value } = changeEmailSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details,
      });
    }

    const currentUser = await User.findById(req.user.sub);

    if (!currentUser) {
      clearAuthCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session.',
      });
    }

    const normalizedEmail = User.normalizeEmail(value.email);

    if (normalizedEmail === currentUser.email) {
      return res.status(400).json({
        success: false,
        message: 'That is already your current email address.',
      });
    }

    const verificationToken = generateEmailVerificationToken();
    const verificationExpiresAt = new Date(Date.now() + (emailVerificationExpiresInMinutes * 60 * 1000));
    const updatedUser = await User.updateEmail(currentUser.id, {
      email: normalizedEmail,
      tokenHash: hashEmailVerificationToken(verificationToken),
      expiresAt: verificationExpiresAt,
    });

    await sendEmailVerificationEmail({
      to: normalizedEmail,
      verificationUrl: getEmailVerificationUrl(verificationToken),
      expiresInMinutes: emailVerificationExpiresInMinutes,
      ign: currentUser.ign,
    });

    const safeUser = User.toSafeUser(updatedUser || currentUser);
    setAuthCookie(res, signUserToken(safeUser));

    return res.json({
      success: true,
      data: safeUser,
      message: 'Email updated. Check your new inbox to verify it.',
    });
  } catch (error) {
    const duplicateMessage = getDuplicateMessage(error);

    if (duplicateMessage) {
      return res.status(409).json({
        success: false,
        message: duplicateMessage,
      });
    }

    console.error('Error changing email:', error);
    return res.status(error.publicMessage ? 503 : 500).json({
      success: false,
      message: error.publicMessage || 'Failed to change email',
    });
  }
});

router.post('/change-password', requireUser, async (req, res) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details,
      });
    }

    const currentUser = await User.findById(req.user.sub);

    if (!currentUser) {
      clearAuthCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session.',
      });
    }

    if (currentUser.password_hash) {
      const passwordMatches = await bcrypt.compare(value.currentPassword || '', currentUser.password_hash);

      if (!passwordMatches) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect.',
        });
      }
    }

    const passwordHash = await bcrypt.hash(value.newPassword, passwordRounds);
    const updatedUser = await User.updatePassword(currentUser.id, passwordHash);

    return res.json({
      success: true,
      data: User.toSafeUser(updatedUser || currentUser),
      message: currentUser.password_hash
        ? 'Password updated successfully.'
        : 'Password added successfully.',
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to change password',
    });
  }
});

router.get('/verify-email', async (req, res) => {
  const { error, value } = verifyEmailSchema.validate(req.query);

  if (error) {
    return res.redirect(buildWebRedirect('/auth', {
      error: 'That verification link is invalid or expired.',
    }));
  }

  try {
    const tokenHash = hashEmailVerificationToken(value.token);
    const user = await User.findByEmailVerificationTokenHash(tokenHash);

    if (!user || isEmailVerificationExpired(user.email_verification_expires_at)) {
      return res.redirect(buildWebRedirect('/auth', {
        error: 'That verification link is invalid or expired.',
      }));
    }

    await User.markEmailVerified(user.id);
    return res.redirect(buildWebRedirect('/auth', {
      mode: 'login',
      status: 'email-verified',
    }));
  } catch (error) {
    console.error('Error verifying email:', error);
    return res.redirect(buildWebRedirect('/auth', {
      error: 'Unable to verify your email.',
    }));
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

router.get('/discord', async (req, res) => {
  try {
    const { error, value } = discordStartSchema.validate(req.query);

    if (error) {
      return res.redirect(buildWebRedirect('/auth', { error: 'Invalid Discord sign-in request.' }));
    }

    if (value.mode === 'register' && !value.ign) {
      return res.redirect(buildWebRedirect('/auth', { error: 'Enter your IGN before continuing with Discord.' }));
    }

    if (value.mode === 'register' && value.ign && isIgnBlacklisted(value.ign)) {
      return res.redirect(buildWebRedirect('/auth', { error: getBlacklistedIgnMessage() }));
    }

    let userId = null;

    if (value.mode === 'connect') {
      const token = getTokenFromRequest(req);

      if (!token) {
        return res.redirect(buildWebRedirect('/auth', { error: 'Sign in before connecting Discord.' }));
      }

      try {
        const session = verifyUserToken(token);
        const user = await User.findById(session.sub);

        if (!user) {
          clearAuthCookie(res);
          return res.redirect(buildWebRedirect('/auth', { error: 'Sign in before connecting Discord.' }));
        }

        userId = user.id;
      } catch {
        clearAuthCookie(res);
        return res.redirect(buildWebRedirect('/auth', { error: 'Sign in before connecting Discord.' }));
      }
    }

    const { clientId, redirectUri } = getDiscordConfig();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: buildState({
        ...value,
        userId,
      }),
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

    if (state.mode === 'register' && state.ign && isIgnBlacklisted(state.ign)) {
      return res.redirect(buildWebRedirect('/auth', { error: getBlacklistedIgnMessage() }));
    }

    const token = await exchangeDiscordCode(req.query.code);
    const discordUser = await fetchDiscordUser(token.access_token);

    if (!discordUser.email) {
      return res.redirect(buildWebRedirect('/auth', { error: 'Discord did not return an email address.' }));
    }

    if (discordUser.verified === false) {
      return res.redirect(buildWebRedirect('/auth', { error: 'Verify your Discord email before signing in.' }));
    }

    let user = await User.findByDiscordId(discordUser.id);

    if (state.mode === 'connect') {
      if (!state.userId) {
        return res.redirect(buildWebRedirect('/auth', { error: 'Discord connection session expired. Please try again.' }));
      }

      const currentUser = await User.findById(state.userId);

      if (!currentUser) {
        clearAuthCookie(res);
        return res.redirect(buildWebRedirect('/auth', { error: 'Sign in before connecting Discord.' }));
      }

      if (user && user.id !== currentUser.id) {
        return res.redirect(buildWebRedirect('/auth', { error: 'That Discord account is already connected to another Team Soju account.' }));
      }

      user = user?.id === currentUser.id
        ? user
        : await User.attachDiscord(currentUser.id, discordUser);
    } else if (!user) {
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
