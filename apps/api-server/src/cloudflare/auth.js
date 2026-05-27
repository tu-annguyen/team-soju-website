const crypto = globalThis.crypto || require('crypto').webcrypto;

const AUTH_COOKIE_NAME = 'team_soju_session';
const USER_TOKEN_TYPE = 'web_user';
const BOT_TOKEN_TYPE = 'discord_bot';
const USER_TOKEN_EXPIRES_IN = '14d';
const USER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = String(value)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');

  return Buffer.from(normalized, 'base64').toString('utf8');
}

function parseExpiresIn(expiresIn) {
  if (typeof expiresIn === 'number') return expiresIn;

  const match = /^(\d+)([smhd])$/.exec(String(expiresIn || '').trim());
  if (!match) {
    throw new Error(`Unsupported expiresIn value: ${expiresIn}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24,
  };

  return amount * multipliers[unit];
}

async function createSignature(secret, payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64UrlEncode(Buffer.from(signature));
}

async function verifySignature(secret, payload, signature) {
  const expected = await createSignature(secret, payload);
  return expected === signature;
}

async function signJwt(payload, secret, options = {}) {
  const nowSeconds = Math.floor((options.now || Date.now()) / 1000);
  const exp = nowSeconds + parseExpiresIn(options.expiresIn || '30d');
  const fullPayload = {
    ...payload,
    iat: nowSeconds,
    exp,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await createSignature(secret, signingInput);

  return `${signingInput}.${signature}`;
}

async function verifyJwt(token, secret) {
  const [encodedHeader, encodedPayload, signature] = String(token || '').split('.');
  if (!encodedHeader || !encodedPayload || !signature) {
    throw new Error('Invalid token.');
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const valid = await verifySignature(secret, signingInput, signature);
  if (!valid) {
    throw new Error('Invalid token.');
  }

  const header = JSON.parse(base64UrlDecode(encodedHeader));
  if (header.alg !== 'HS256') {
    throw new Error('Invalid token.');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp && nowSeconds >= payload.exp) {
    throw new Error('Invalid token.');
  }

  return payload;
}

async function generateBotToken(secret) {
  return signJwt(
    {
      type: BOT_TOKEN_TYPE,
      permissions: ['read', 'write', 'delete'],
    },
    secret,
    { expiresIn: '30d' }
  );
}

async function signUserToken(user, env = {}) {
  return signJwt(
    {
      type: USER_TOKEN_TYPE,
      sub: user.id,
      email: user.email,
      ign: user.ign,
    },
    env.JWT_SECRET,
    { expiresIn: USER_TOKEN_EXPIRES_IN }
  );
}

async function authenticateBotRequest(request, env) {
  const headerValue = request.headers.get('authorization');
  const token = headerValue?.replace('Bearer ', '');

  if (!token) {
    return {
      ok: false,
      response: {
        status: 401,
        body: { success: false, message: 'Access denied. No token provided.' },
      },
    };
  }

  try {
    const decoded = await verifyJwt(token, env.JWT_SECRET);
    if (decoded?.type !== BOT_TOKEN_TYPE) {
      return {
        ok: false,
        response: {
          status: 403,
          body: { success: false, message: 'Forbidden. Not a bot token.' },
        },
      };
    }

    return { ok: true, bot: decoded };
  } catch {
    return {
      ok: false,
      response: {
        status: 400,
        body: { success: false, message: 'Invalid token.' },
      },
    };
  }
}

function getAuthCookieName(env = {}) {
  return env.AUTH_COOKIE_NAME || AUTH_COOKIE_NAME;
}

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex === -1) return cookies;

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
  if (options.domain) {
    segments.push(`Domain=${options.domain}`);
  }

  return segments.join('; ');
}

function getAuthCookieOptions(env = {}) {
  const isProduction = env.NODE_ENV === 'production';

  // Allow overriding cookie settings via env to support staging previews
  const overrideSameSite = typeof env.AUTH_COOKIE_SAMESITE === 'string' ? env.AUTH_COOKIE_SAMESITE : null;
  const overrideSecure = typeof env.AUTH_COOKIE_SECURE === 'string' ? env.AUTH_COOKIE_SECURE === 'true' : null;
  const domain = typeof env.AUTH_COOKIE_DOMAIN === 'string' && env.AUTH_COOKIE_DOMAIN.trim() ? env.AUTH_COOKIE_DOMAIN.trim() : undefined;

  return {
    httpOnly: true,
    secure: overrideSecure !== null ? overrideSecure : isProduction,
    sameSite: overrideSameSite || (isProduction ? 'None' : 'Lax'),
    path: '/',
    domain,
  };
}

function clearAuthCookie(env = {}) {
  return serializeCookie(getAuthCookieName(env), '', {
    ...getAuthCookieOptions(env),
    maxAge: 0,
  });
}

function setAuthCookie(token, env = {}) {
  return serializeCookie(getAuthCookieName(env), token, {
    ...getAuthCookieOptions(env),
    maxAge: USER_COOKIE_MAX_AGE_SECONDS,
  });
}

function getTokenFromRequest(request, env = {}) {
  const authorizationToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (authorizationToken) {
    return authorizationToken;
  }

  const cookies = parseCookies(request.headers.get('cookie') || '');
  return cookies[getAuthCookieName(env)];
}

async function verifyUserToken(token, env = {}) {
  const decoded = await verifyJwt(token, env.JWT_SECRET);

  if (decoded?.type !== USER_TOKEN_TYPE || !decoded?.sub) {
    const error = new Error('Invalid user token.');
    error.code = 'INVALID_USER_TOKEN';
    throw error;
  }

  return decoded;
}

module.exports = {
  AUTH_COOKIE_NAME,
  authenticateBotRequest,
  clearAuthCookie,
  generateBotToken,
  getTokenFromRequest,
  parseCookies,
  serializeCookie,
  signJwt,
  signUserToken,
  setAuthCookie,
  verifyJwt,
  verifyUserToken,
};
