async function request(url, options = {}) {
  const response = await fetch(url, options);
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
