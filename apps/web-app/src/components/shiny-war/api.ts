export async function shinyWarRequest<T>(
  apiBaseUrl: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/shiny-war${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || 'Shiny Wars request failed.');
  return body.data as T;
}

