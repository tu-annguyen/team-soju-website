import { useEffect, useState } from 'react';
import HuntFinderControls from '../hunt-finder/HuntFinderControls';
import type { HuntFinderContext, HuntFinderFilters } from '../hunt-finder/types';
import { getHuntFinderMessages } from '../hunt-finder/messages';
import { getPokeMmoClockState } from './pokeMmoClockState';
import { shinyWarRequest } from './api';
import HuntResults, { type HuntView } from './HuntResults';
import { huntLocationKey } from './huntLocationGroups';
import { groupHuntSpotsByPokemonLocation } from './huntPokemonLocationGroups';
import type { HuntSpecies, HuntSpot, ParticipantHunts } from './types';

type Props = {
  apiBaseUrl: string;
  context?: HuntFinderContext;
  caughtFamilyKeys?: string[];
  defaultSeason?: string;
  locale?: string;
  officialCaughtFamilyKeys?: string[];
  participants?: ParticipantHunts[];
  teamCaughtFamilyKeys?: string[];
  onQueue?: (spot: HuntSpot, current: boolean, targetSpecies?: HuntSpecies, title?: string) => void;
};

type HuntFinderResponse = { items: HuntSpot[]; total: number; locations: string[] };
const EMPTY_FAMILY_KEYS: string[] = [];

function initialFilters(context: HuntFinderContext, defaultSeason: string): HuntFinderFilters {
  return {
    season: defaultSeason || getPokeMmoClockState(new Date()).season,
    region: '', location: '', species: '', minTier: '', minLevel: '', time: '', method: 'All',
    hordeSize: '', hordesPerHour: '240', eventBoost: false, donator: false,
    fullSplitOnly: false, minPointsPerHour: '', personalCharm: false, linkCharm: false,
    chumBucket: false, nonSafari: false,
    officialUniqueBonus: context === 'shinyWar', teamUniqueBonus: false,
    excludeOfficialCaught: false, excludeTeamCaught: false,
    evStats: [], evAmounts: [], expCharm: '', expReamplifier: false, expDonator: false, tradeBonus: false,
    sort: 'alphabetical', sortDirection: 'asc',
  };
}

async function requestPublicFinder(apiBaseUrl: string, path: string): Promise<HuntFinderResponse> {
  const response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/hunt-finder${path}`);
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || 'Hunt Finder request failed.');
  return body.data as HuntFinderResponse;
}

function buildSearchParams(
  filters: HuntFinderFilters,
  context: HuntFinderContext,
  caughtFamilyKeys: string[],
  officialCaughtFamilyKeys: string[],
  teamCaughtFamilyKeys?: string[]
) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (!['All', 'Sweet Scent'].includes(filters.method)
      && ['hordeSize', 'hordesPerHour', 'fullSplitOnly'].includes(key)) return;
    if (['Headbutt', 'Rock Smash'].includes(filters.method) && key === 'minPointsPerHour') return;
    if (!['All', 'Singles', 'Fishing'].includes(filters.method) && key === 'nonSafari') return;
    if (filters.sort !== 'pointsPerHour'
      && ['eventBoost', 'donator', 'personalCharm', 'linkCharm', 'chumBucket', 'minPointsPerHour'].includes(key)) return;
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
  params.set('pageSize', '1000');
  return params;
}

export default function HuntFinder({
  apiBaseUrl,
  context = 'shinyWar',
  caughtFamilyKeys = EMPTY_FAMILY_KEYS,
  defaultSeason = '',
  locale,
  officialCaughtFamilyKeys = EMPTY_FAMILY_KEYS,
  participants = [],
  teamCaughtFamilyKeys,
  onQueue,
}: Props) {
  const [filters, setFilters] = useState<HuntFinderFilters>(() => initialFilters(context, defaultSeason));
  const [spots, setSpots] = useState<HuntSpot[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [collapsedLocationViewLocations, setCollapsedLocationViewLocations] = useState<Set<string>>(() => new Set());
  const [pokemonLocationOverrides, setPokemonLocationOverrides] = useState<Map<string, boolean>>(() => new Map());
  const [view, setView] = useState<HuntView>('location');
  const [error, setError] = useState('');
  const messages = getHuntFinderMessages(locale);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        setError('');
        const params = buildSearchParams(
          filters, context, caughtFamilyKeys, officialCaughtFamilyKeys, teamCaughtFamilyKeys
        );
        const path = context === 'public' ? `/spots?${params}` : `/hordes?${params}`;
        const data = context === 'public'
          ? await requestPublicFinder(apiBaseUrl, path)
          : await shinyWarRequest<HuntFinderResponse>(apiBaseUrl, path);
        setSpots(data.items);
        setTotal(data.total);
        setLocations(data.locations || []);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : messages.results.couldNotLoad);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [apiBaseUrl, caughtFamilyKeys, context, filters, messages.results.couldNotLoad, officialCaughtFamilyKeys, teamCaughtFamilyKeys]);

  const locationViewKeys = [...new Set(spots.map(huntLocationKey))];
  const pokemonLocationGroups = groupHuntSpotsByPokemonLocation(
    spots, filters.species, filters.minTier, filters.sort, filters.sortDirection
  );
  const pokemonLocationDefaults = new Map(
    pokemonLocationGroups.flatMap(({ locations: groupedLocations }) => (
      groupedLocations.map(({ key }, index) => [key, index > 0] as const)
    ))
  );
  const pokemonViewKeys = [...pokemonLocationDefaults.keys()];
  const collapsedPokemonViewLocations = new Set(
    pokemonViewKeys.filter((key) => pokemonLocationOverrides.get(key) ?? pokemonLocationDefaults.get(key))
  );
  const visibleLocationKeys = view === 'location' ? locationViewKeys : pokemonViewKeys;
  const collapsedLocations = view === 'location' ? collapsedLocationViewLocations : collapsedPokemonViewLocations;
  const allLocationsOpen = visibleLocationKeys.length > 0
    && visibleLocationKeys.every((locationKey) => !collapsedLocations.has(locationKey));

  const toggleAllLocations = () => {
    if (view === 'location') {
      setCollapsedLocationViewLocations(allLocationsOpen ? new Set(visibleLocationKeys) : new Set());
      return;
    }
    setPokemonLocationOverrides((current) => {
      const next = new Map(current);
      visibleLocationKeys.forEach((key) => next.set(key, allLocationsOpen));
      return next;
    });
  };

  const toggleLocation = (locationKey: string) => {
    if (view === 'location') {
      setCollapsedLocationViewLocations((current) => {
        const next = new Set(current);
        if (next.has(locationKey)) next.delete(locationKey);
        else next.add(locationKey);
        return next;
      });
      return;
    }
    setPokemonLocationOverrides((current) => {
      const next = new Map(current);
      next.set(locationKey, !collapsedPokemonViewLocations.has(locationKey));
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <HuntFinderControls context={context} filters={filters} locale={locale} locations={locations} setFilters={setFilters} teamWarAvailable={teamCaughtFamilyKeys !== undefined} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" aria-label="Group hunt results by" role="group">
          {([['location', messages.results.location], ['pokemon', messages.results.pokemon]] as const).map(([value, label]) => (
            <button aria-pressed={view === value} className={`rounded-full px-4 py-2 text-sm font-semibold ${view === value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'}`} key={value} onClick={() => setView(value)} type="button">{label}</button>
          ))}
        </div>
        <button className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700" disabled={visibleLocationKeys.length === 0} onClick={toggleAllLocations} type="button">
          <span aria-hidden="true">{allLocationsOpen ? '-' : '+'}</span>{' '}{allLocationsOpen ? messages.results.collapseAll : messages.results.openAll}
        </button>
      </div>
      <p className="text-sm text-gray-500">{total} {messages.results.matching}</p>
      {error && <p role="alert" className="text-rose-600">{error}</p>}
      <HuntResults
        collapsedLocations={collapsedLocations}
        context={context}
        minimumTier={filters.minTier}
        locale={locale}
        onQueue={onQueue}
        onToggleLocation={toggleLocation}
        participants={participants}
        selectedSeason={filters.season}
        selectedTime={filters.time}
        sort={filters.sort}
        sortDirection={filters.sortDirection}
        speciesFilter={filters.species}
        spots={spots}
        view={view}
        onSeasonChange={(season) => setFilters((current) => ({ ...current, season }))}
        onTimeChange={(time) => setFilters((current) => ({ ...current, time }))}
      />
    </div>
  );
}
