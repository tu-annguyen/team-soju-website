import { useEffect, useState } from 'react';
import { ACTIVE_LOCATION_STORAGE_KEY, getInitialLocationId, resolveLocationId } from './shared';

export function useStoredFeebasLocation(location: string | undefined) {
  const [activeLocation, setActiveLocation] = useState(() => getInitialLocationId(location));

  useEffect(() => {
    if (location) setActiveLocation(resolveLocationId(location));
  }, [location]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_LOCATION_STORAGE_KEY, activeLocation);
    } catch {
      // Ignore storage write failures.
    }
  }, [activeLocation]);

  return { activeLocation, setActiveLocation };
}
