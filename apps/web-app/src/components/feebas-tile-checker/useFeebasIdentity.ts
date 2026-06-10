import { useEffect, useState } from 'react';
import type { AuthResponse, AuthUser } from './shared';
import { CLIENT_ID_STORAGE_KEY, createClientId, isAuthUser } from './shared';

export function useFeebasIdentity(normalizedApiBaseUrl: string) {
  const [clientId, setClientId] = useState('');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    try {
      const storedClientId = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
      const resolvedClientId = storedClientId || createClientId();
      localStorage.setItem(CLIENT_ID_STORAGE_KEY, resolvedClientId);
      setClientId(resolvedClientId);
    } catch {
      setClientId(createClientId());
    }
  }, []);

  useEffect(() => {
    const handleAuthUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<AuthUser | null>;
      const nextUser = customEvent.detail;

      setAuthUser(isAuthUser(nextUser) ? nextUser : null);
      setIsAuthLoading(false);
    };

    window.addEventListener('team-soju-auth-updated', handleAuthUpdated);

    return () => {
      window.removeEventListener('team-soju-auth-updated', handleAuthUpdated);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadAuthUser() {
      setIsAuthLoading(true);

      try {
        const response = await fetch(`${normalizedApiBaseUrl}/auth/me`, {
          credentials: 'include',
        });
        const body = await response.json() as AuthResponse;
        const nextUser = body.data;

        if (mounted && response.ok && body.success && isAuthUser(nextUser)) {
          setAuthUser(nextUser);
        } else if (mounted) {
          setAuthUser(null);
        }
      } catch {
        if (mounted) setAuthUser(null);
      } finally {
        if (mounted) setIsAuthLoading(false);
      }
    }

    loadAuthUser();

    return () => {
      mounted = false;
    };
  }, [normalizedApiBaseUrl]);

  return { authUser, clientId, isAuthLoading };
}
