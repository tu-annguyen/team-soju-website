import { useEffect, useState } from 'react';
import type { AuthResponse, AuthUser } from './types';

export function useAuthUser(apiBaseUrl: string) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const normalizedApiBaseUrl = apiBaseUrl.replace(/\/+$/, '');

  useEffect(() => {
    const handleAuthUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<AuthUser | null>;
      setAuthUser(customEvent.detail || null);
      setIsAuthLoading(false);
    };

    window.addEventListener('team-soju-auth-updated', handleAuthUpdated);
    return () => window.removeEventListener('team-soju-auth-updated', handleAuthUpdated);
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

        if (mounted) {
          setAuthUser(response.ok && body.success ? body.data || null : null);
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

  return { authUser, isAuthLoading };
}
