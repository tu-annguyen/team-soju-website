const jwt = require('jsonwebtoken');

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'team_soju_session';
const USER_TOKEN_TYPE = 'web_user';
const BOT_TOKEN_TYPE = 'discord_bot';
const USER_TOKEN_EXPIRES_IN = '14d';
const USER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required for authentication');
  }

  return process.env.JWT_SECRET;
}

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const separatorIndex = entry.indexOf('=');

      if (separatorIndex === -1) {
        return cookies;
      }

      const key = decodeURIComponent(entry.slice(0, separatorIndex));
      const value = decodeURIComponent(entry.slice(separatorIndex + 1));
      cookies[key] = value;
      return cookies;
    }, {});
}

function serializeCookie(name, value, options = {}) {
  const segments = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  if (typeof options.maxAge === 'number') {
    segments.push(`Max-Age=${options.maxAge}`);
  }

  if (options.path) {
    segments.push(`Path=${options.path}`);
  }

  if (options.httpOnly) {
    segments.push('HttpOnly');
  }

  if (options.secure) {
    segments.push('Secure');
  }

  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }

  if (options.partitioned) {
    segments.push('Partitioned');
  }

  return segments.join('; ');
}

function getAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const secure = isProduction;
  const sameSite = isProduction ? 'None' : 'Lax';
  const overridePartitioned = typeof process.env.AUTH_COOKIE_PARTITIONED === 'string'
    ? process.env.AUTH_COOKIE_PARTITIONED === 'true'
    : null;
  const partitioned = overridePartitioned !== null
    ? overridePartitioned
    : secure && sameSite.toLowerCase() === 'none';

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    partitioned,
  };
}

function getTokenFromRequest(req) {
  const authorizationToken = req.header('Authorization')?.replace(/^Bearer\s+/i, '');

  if (authorizationToken) {
    return authorizationToken;
  }

  const cookies = parseCookies(req.header('Cookie'));
  return cookies[AUTH_COOKIE_NAME];
}

function signUserToken(user) {
  return jwt.sign(
    {
      type: USER_TOKEN_TYPE,
      sub: user.id,
      email: user.email,
      ign: user.ign,
    },
    getJwtSecret(),
    { expiresIn: USER_TOKEN_EXPIRES_IN }
  );
}

function verifyUserToken(token) {
  const decoded = jwt.verify(token, getJwtSecret());

  if (decoded?.type !== USER_TOKEN_TYPE || !decoded?.sub) {
    const error = new Error('Invalid user token.');
    error.code = 'INVALID_USER_TOKEN';
    throw error;
  }

  return decoded;
}

function setAuthCookie(res, token) {
  res.setHeader('Set-Cookie', serializeCookie(AUTH_COOKIE_NAME, token, {
    ...getAuthCookieOptions(),
    maxAge: USER_COOKIE_MAX_AGE_SECONDS,
  }));
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', serializeCookie(AUTH_COOKIE_NAME, '', {
    ...getAuthCookieOptions(),
    maxAge: 0,
  }));
}

const requireUser = (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not signed in.' });
  }

  try {
    req.user = verifyUserToken(token);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired session.' });
  }
};

// Simple authentication middleware for Discord bot requests
const authenticateBot = (req, res, next) => {
  const token = req.header('Authorization')?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (decoded?.type !== BOT_TOKEN_TYPE) {
      return res.status(403).json({ success: false, message: 'Forbidden. Not a bot token.' });
    }

    req.bot = decoded;
    next();
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid token.' });
  }
};

// Generate a token for the Discord bot
const generateBotToken = () => {
  return jwt.sign(
    { 
      type: BOT_TOKEN_TYPE,
      permissions: ['read', 'write', 'delete']
    },
    getJwtSecret(),
    { expiresIn: '30d' }
  );
};

module.exports = {
  AUTH_COOKIE_NAME,
  authenticateBot,
  clearAuthCookie,
  generateBotToken,
  getJwtSecret,
  getTokenFromRequest,
  parseCookies,
  requireUser,
  setAuthCookie,
  signUserToken,
  verifyUserToken,
};
