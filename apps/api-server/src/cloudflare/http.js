function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8');
  }

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function empty(status = 204, init = {}) {
  return new Response(null, {
    ...init,
    status,
  });
}

function securityHeaders() {
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'same-origin',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'cross-origin',
  };
}

function buildCorsHeaders(request, env = {}) {
  const origin = request.headers.get('origin');
  const allowList = (
    env.CORS_ORIGINS ||
    (
      env.NODE_ENV === 'production'
        ? [
          'https://team-soju.netlify.app',
          'https://teamsoju.com',
          'https://www.teamsoju.com',
          'https://soju.team',
          'https://www.soju.team',
          'https://team-soju-hpzrujm4n-tu-annguyens-projects.vercel.app',
        ].join(',')
        : 'http://localhost:3000,http://localhost:4321'
    )
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const headers = {
    ...securityHeaders(),
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'Authorization, Content-Type',
    'access-control-allow-methods': 'GET,HEAD,POST,PUT,DELETE,OPTIONS',
    vary: 'Origin',
  };

  if (origin && allowList.includes(origin)) {
    headers['access-control-allow-origin'] = origin;
  } else if (env.NODE_ENV !== 'production' && origin) {
    headers['access-control-allow-origin'] = origin;
  }

  return headers;
}

function withStandardHeaders(response, request, env) {
  const headers = buildCorsHeaders(request, env);
  const nextHeaders = new Headers(response.headers);

  Object.entries(headers).forEach(([name, value]) => {
    if (value && !nextHeaders.has(name)) {
      nextHeaders.set(name, value);
    }
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders,
  });
}

async function readJson(request) {
  const bodyText = await request.text();
  if (!bodyText) return {};
  return JSON.parse(bodyText);
}

module.exports = {
  buildCorsHeaders,
  empty,
  json,
  readJson,
  withStandardHeaders,
};
