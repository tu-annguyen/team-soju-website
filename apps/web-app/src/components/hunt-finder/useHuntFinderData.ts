import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import type { HuntSpot } from '../shiny-war/types';
import { shinyWarRequest } from '../shiny-war/api';
import type { HuntFinderContext, HuntFinderFilters } from './types';

const PAGE_SIZE = 30;
const FILTER_DEBOUNCE_MS = 300;

type HuntFinderResponse = {
  items: HuntSpot[];
  total: number;
  locations: string[];
  page?: number;
  pageSize?: number;
};

type Options = {
  apiBaseUrl: string;
  caughtFamilyKeys: string[];
  context: HuntFinderContext;
  filters: HuntFinderFilters;
  loadErrorMessage: string;
  loadMoreErrorMessage: string;
  officialCaughtFamilyKeys: string[];
  teamCaughtFamilyKeys?: string[];
};

function buildSearchParams(
  filters: HuntFinderFilters,
  context: HuntFinderContext,
  caughtFamilyKeys: string[],
  officialCaughtFamilyKeys: string[],
  teamCaughtFamilyKeys: string[] | undefined,
  page: number
) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (!['All', 'Sweet Scent'].includes(filters.method)
      && ['hordeSize', 'fullSplitOnly'].includes(key)) return;
    if (['All', 'Headbutt', 'Rock Smash'].includes(filters.method) && key === 'encountersPerHour') return;
    if (['Headbutt', 'Rock Smash'].includes(filters.method) && ['minPointsPerHour', 'minExpPerHour'].includes(key)) return;
    if (!['All', 'Singles', 'Fishing'].includes(filters.method) && key === 'nonSafari') return;
    if (filters.sort === 'expPerHour' && ['minTier', 'minPointsPerHour'].includes(key)) return;
    if (filters.sort === 'pointsPerHour' && ['minLevel', 'minExpPerHour', 'evStats', 'evAmounts', 'eggGroups'].includes(key)) return;
    if (filters.sort !== 'pointsPerHour'
      && ['eventBoost', 'donator', 'personalCharm', 'linkCharm', 'chumBucket'].includes(key)) return;
    if (filters.sort !== 'expPerHour' && ['expCharm', 'expReamplifier', 'expDonator', 'tradeBonus'].includes(key)) return;
    if (key === 'chumBucket' && !['All', 'Fishing'].includes(filters.method)) return;
    if (context === 'public' && [
      'officialUniqueBonus', 'teamUniqueBonus', 'excludeOfficialCaught', 'excludeTeamCaught',
    ].includes(key)) return;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
    } else if (value !== '') {
      params.set(key, String(value));
    }
  });
  if (context === 'shinyWar') {
    if (filters.officialUniqueBonus || filters.excludeOfficialCaught) {
      params.set('officialCaughtFamilyKeys', officialCaughtFamilyKeys.join(','));
    }
    if (filters.teamUniqueBonus || filters.excludeTeamCaught) {
      params.set('teamCaughtFamilyKeys', (teamCaughtFamilyKeys || []).join(','));
    }
    params.set('playerCaughtFamilyKeys', caughtFamilyKeys.join(','));
  }
  params.set('page', String(page));
  params.set('pageSize', String(PAGE_SIZE));
  return params;
}

async function requestPublicFinder(
  apiBaseUrl: string,
  path: string,
  signal: AbortSignal
): Promise<HuntFinderResponse> {
  const response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/hunt-finder${path}`, { signal });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || 'Hunt Finder request failed.');
  return body.data as HuntFinderResponse;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

export function useHuntFinderData({
  apiBaseUrl, caughtFamilyKeys, context, filters, loadErrorMessage, loadMoreErrorMessage,
  officialCaughtFamilyKeys, teamCaughtFamilyKeys,
}: Options) {
  const [queryFilters, setQueryFilters] = useState(filters);
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [spots, setSpots] = useState<HuntSpot[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const requestId = useRef(0);
  const controller = useRef<AbortController>();

  useEffect(() => () => {
    requestId.current += 1;
    controller.current?.abort();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setQueryFilters(filters), FILTER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [filters]);

  const requestPage = useCallback(async (
    requestedFilters: HuntFinderFilters,
    requestedPage: number,
    signal: AbortSignal
  ) => {
    const params = buildSearchParams(
      requestedFilters, context, caughtFamilyKeys, officialCaughtFamilyKeys,
      teamCaughtFamilyKeys, requestedPage
    );
    const path = context === 'public' ? `/spots?${params}` : `/hordes?${params}`;
    return context === 'public'
      ? requestPublicFinder(apiBaseUrl, path, signal)
      : shinyWarRequest<HuntFinderResponse>(apiBaseUrl, path, { signal });
  }, [apiBaseUrl, caughtFamilyKeys, context, officialCaughtFamilyKeys, teamCaughtFamilyKeys]);

  useEffect(() => {
    const activeRequestId = ++requestId.current;
    controller.current?.abort();
    const activeController = new AbortController();
    controller.current = activeController;
    const timer = window.setTimeout(() => {
      setError('');
      setLoadMoreError('');
      setIsLoadingMore(false);
      setIsRefreshing(!isInitialLoading);

      requestPage(queryFilters, 1, activeController.signal).then((data) => {
        if (activeRequestId !== requestId.current) return;
        startTransition(() => {
          setSpots(data.items);
          setTotal(data.total);
          setLocations(data.locations || []);
          setPage(data.page || 1);
          setAppliedFilters(queryFilters);
          setIsInitialLoading(false);
          setIsRefreshing(false);
        });
      }).catch((requestError: unknown) => {
        if (!isAbortError(requestError) && activeRequestId === requestId.current) {
          setError(requestError instanceof Error ? requestError.message : loadErrorMessage);
          setIsInitialLoading(false);
          setIsRefreshing(false);
        }
      });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      activeController.abort();
      if (requestId.current === activeRequestId) requestId.current += 1;
    };
  }, [queryFilters, requestPage, loadErrorMessage]);

  const loadMore = useCallback(async () => {
    const activeRequestId = ++requestId.current;
    controller.current?.abort();
    const activeController = new AbortController();
    controller.current = activeController;
    setIsLoadingMore(true);
    setLoadMoreError('');
    try {
      const data = await requestPage(appliedFilters, page + 1, activeController.signal);
      if (activeRequestId !== requestId.current) return;
      startTransition(() => {
        setSpots((current) => {
          const existingKeys = new Set(current.map((spot) => spot.spot_key));
          return [...current, ...data.items.filter((spot) => !existingKeys.has(spot.spot_key))];
        });
        setTotal(data.total);
        setLocations(data.locations || []);
        setPage(data.page || page + 1);
        setIsLoadingMore(false);
      });
    } catch (requestError) {
      if (!isAbortError(requestError) && activeRequestId === requestId.current) {
        setLoadMoreError(requestError instanceof Error ? requestError.message : loadMoreErrorMessage);
        setIsLoadingMore(false);
      }
    }
  }, [appliedFilters, loadMoreErrorMessage, page, requestPage]);

  return {
    appliedFilters, error, isInitialLoading, isLoadingMore, isRefreshing, loadMore,
    loadMoreError, locations, spots, total,
  };
}
