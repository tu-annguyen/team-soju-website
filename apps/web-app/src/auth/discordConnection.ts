type DiscordAuthorizationResponse = {
  success?: boolean;
  data?: {
    authorizationUrl?: string;
  };
  message?: string;
};

export async function getDiscordConnectionUrl(apiBaseUrl: string, returnTo: string) {
  const normalizedApiBaseUrl = apiBaseUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({
    mode: 'connect',
    returnTo,
  });
  const response = await fetch(`${normalizedApiBaseUrl}/auth/discord?${params.toString()}`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });
  const body = await response.json() as DiscordAuthorizationResponse;
  const authorizationUrl = body.data?.authorizationUrl;

  if (!response.ok || !body.success || !authorizationUrl) {
    throw new Error(body.message || 'Unable to start Discord connection.');
  }

  return authorizationUrl;
}
