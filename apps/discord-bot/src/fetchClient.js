const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.DISCORD_BOT_HTTP_TIMEOUT_MS || '', 10) || 15000;
const DEFAULT_MAX_RETRIES = Number.parseInt(process.env.DISCORD_BOT_HTTP_RETRY_COUNT || '', 10) || 2;
const DEFAULT_RETRY_DELAY_MS = Number.parseInt(process.env.DISCORD_BOT_HTTP_RETRY_DELAY_MS || '', 10) || 250;

function isRetryableStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function isRetryableError(error) {
  return error?.code === 'REQUEST_TIMEOUT'
    || error?.name === 'TypeError'
    || error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT'
    || error?.cause?.code === 'ECONNRESET'
    || error?.cause?.code === 'ENOTFOUND';
}

function getRetryDelayMs(attempt, response) {
  const retryAfterSeconds = Number.parseFloat(response?.headers?.get?.('retry-after') || '');
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  return DEFAULT_RETRY_DELAY_MS * attempt;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
  const maxRetries = Number.isFinite(options.maxRetries) ? Math.max(0, options.maxRetries) : DEFAULT_MAX_RETRIES;
  const { timeoutMs: _timeoutMs, maxRetries: _maxRetries, ...fetchOptions } = options;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    const { init, clear } = withTimeout(fetchOptions, timeoutMs);
    let response;

    try {
      response = await fetch(url, init);
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error(`Request timed out after ${Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS}ms`);
        timeoutError.code = 'REQUEST_TIMEOUT';
        if (attempt <= maxRetries) {
          await wait(getRetryDelayMs(attempt));
          continue;
        }
        throw timeoutError;
      }

      if (attempt <= maxRetries && isRetryableError(error)) {
        await wait(getRetryDelayMs(attempt));
        continue;
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
      console.error('[discord] Upstream request failed:', {
        method: init.method || 'GET',
        url,
        status: response.status,
        statusText: response.statusText,
        body: typeof payload === 'string' ? payload.slice(0, 300) : payload,
      });
      const error = new Error(
        payload?.message ||
        payload?.error ||
        response.statusText ||
        `Request failed with status ${response.status}`
      );
      error.response = {
        status: response.status,
        data: payload,
        headers: response.headers,
      };

      if (attempt <= maxRetries && isRetryableStatus(response.status)) {
        await wait(getRetryDelayMs(attempt, response));
        continue;
      }

      throw error;
    }

    return { data: payload };
  }

  throw new Error('Request failed without producing a response.');
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
