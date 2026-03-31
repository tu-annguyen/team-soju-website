const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.DISCORD_BOT_HTTP_TIMEOUT_MS || '', 10) || 15000;

function withTimeout(init = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const normalizedTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), normalizedTimeoutMs);

  return {
    init: {
      ...init,
      signal: controller.signal,
    },
    clear: () => clearTimeout(timeout),
  };
}

async function request(url, options = {}) {
  const timeoutMs = options.timeoutMs;
  const { timeoutMs: _timeoutMs, ...fetchOptions } = options;
  const { init, clear } = withTimeout(fetchOptions, timeoutMs);
  let response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Request timed out after ${Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS}ms`);
      timeoutError.code = 'REQUEST_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clear();
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(
      payload?.message ||
      payload?.error ||
      response.statusText ||
      `Request failed with status ${response.status}`
    );
    error.response = {
      status: response.status,
      data: payload,
    };
    throw error;
  }

  return { data: payload };
}

function withJsonBody(body, options = {}) {
  return {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: JSON.stringify(body),
  };
}

module.exports = {
  get(url, options) {
    return request(url, { method: 'GET', ...(options || {}) });
  },
  post(url, body, options) {
    return request(url, withJsonBody(body, { method: 'POST', ...(options || {}) }));
  },
  put(url, body, options) {
    return request(url, withJsonBody(body, { method: 'PUT', ...(options || {}) }));
  },
  delete(url, options) {
    return request(url, { method: 'DELETE', ...(options || {}) });
  },
};
