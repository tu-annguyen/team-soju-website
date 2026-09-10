import { startTransition, useCallback, useMemo, useRef, useState } from 'react';
import HuntFinderControls from '../hunt-finder/HuntFinderControls';
import HuntResultsSkeleton from '../hunt-finder/HuntResultsSkeleton';
import type { DisplayedPokemonInfo, HuntFinderContext, HuntFinderFilters } from '../hunt-finder/types';
import { getHuntFinderMessages } from '../hunt-finder/messages';
import { useHuntFinderData } from '../hunt-finder/useHuntFinderData';
import { getPokeMmoClockState } from './pokeMmoClockState';
import HuntResults, { type HuntView } from './HuntResults';
import { groupHuntSpotsByLocation } from './huntLocationGroups';
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

const EMPTY_FAMILY_KEYS: string[] = [];

function initialFilters(context: HuntFinderContext, defaultSeason: string): HuntFinderFilters {
  return {
    season: defaultSeason || getPokeMmoClockState(new Date()).season,
    region: '', location: '', species: '', minTier: '', minLevel: '', time: '', method: 'All',
    hordeSize: '', encountersPerHour: '', eventBoost: false, donator: false,
    fullSplitOnly: false, minPointsPerHour: '', minExpPerHour: '', personalCharm: false, linkCharm: false,
    chumBucket: false, nonSafari: false,
    officialUniqueBonus: context === 'shinyWar', teamUniqueBonus: false,
    excludeOfficialCaught: false, excludeTeamCaught: false,
    evStats: [], evAmounts: [], eggGroups: [], expCharm: '', expReamplifier: false, expDonator: false, tradeBonus: false,
    sort: 'alphabetical', sortDirection: 'asc',
  };
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
  const [displayedInfo, setDisplayedInfo] = useState<DisplayedPokemonInfo[]>([]);
  const [collapsedLocationViewLocations, setCollapsedLocationViewLocations] = useState<Set<string>>(() => new Set());
  const [pokemonLocationOverrides, setPokemonLocationOverrides] = useState<Map<string, boolean>>(() => new Map());
  const [view, setView] = useState<HuntView>('location');
  const messages = getHuntFinderMessages(locale);
  const {
    appliedFilters, error, isInitialLoading, isLoadingMore, isRefreshing, loadMore,
    loadMoreError, locations, spots, total,
  } = useHuntFinderData({
    apiBaseUrl, caughtFamilyKeys, context, filters,
    loadErrorMessage: messages.results.couldNotLoad,
    loadMoreErrorMessage: messages.results.couldNotLoadMore,
    officialCaughtFamilyKeys, teamCaughtFamilyKeys,
  });
  const locationGroups = useMemo(
    () => view === 'location' ? groupHuntSpotsByLocation(spots) : [],
    [spots, view]
  );
  const pokemonLocationGroups = useMemo(
    () => view === 'pokemon' ? groupHuntSpotsByPokemonLocation(
      spots, appliedFilters.species,
      appliedFilters.sort === 'expPerHour' ? '' : appliedFilters.minTier,
      appliedFilters.sort, appliedFilters.sortDirection
    ) : [],
    [appliedFilters.minTier, appliedFilters.sort, appliedFilters.sortDirection, appliedFilters.species, spots, view]
  );
  const locationViewKeys = useMemo(() => locationGroups.map(({ key }) => key), [locationGroups]);
  const pokemonLocationDefaults = useMemo(() => new Map(
    pokemonLocationGroups.flatMap(({ locations: groupedLocations }) => (
      groupedLocations.map(({ key }, index) => [key, index > 0] as const)
    ))
  ), [pokemonLocationGroups]);
  const pokemonLocationDefaultsRef = useRef(pokemonLocationDefaults);
  pokemonLocationDefaultsRef.current = pokemonLocationDefaults;
  const pokemonViewKeys = useMemo(() => [...pokemonLocationDefaults.keys()], [pokemonLocationDefaults]);
  const collapsedPokemonViewLocations = useMemo(() => new Set(
    pokemonViewKeys.filter((key) => pokemonLocationOverrides.get(key) ?? pokemonLocationDefaults.get(key))
  ), [pokemonLocationDefaults, pokemonLocationOverrides, pokemonViewKeys]);
  const visibleLocationKeys = view === 'location' ? locationViewKeys : pokemonViewKeys;
  const collapsedLocations = view === 'location' ? collapsedLocationViewLocations : collapsedPokemonViewLocations;
  const allLocationsOpen = visibleLocationKeys.length > 0
    && visibleLocationKeys.every((locationKey) => !collapsedLocations.has(locationKey));

  const toggleAllLocations = () => startTransition(() => {
    if (view === 'location') {
      setCollapsedLocationViewLocations(allLocationsOpen ? new Set(visibleLocationKeys) : new Set());
    } else {
      setPokemonLocationOverrides((current) => {
        const next = new Map(current);
        visibleLocationKeys.forEach((key) => next.set(key, allLocationsOpen));
        return next;
      });
    }
  });

  const toggleLocation = useCallback((locationKey: string) => {
    if (view === 'location') {
      setCollapsedLocationViewLocations((current) => {
        const next = new Set(current);
        if (next.has(locationKey)) next.delete(locationKey);
        else next.add(locationKey);
        return next;
      });
    } else {
      setPokemonLocationOverrides((current) => {
        const next = new Map(current);
        const collapsed = current.get(locationKey) ?? pokemonLocationDefaultsRef.current.get(locationKey) ?? false;
        next.set(locationKey, !collapsed);
        return next;
      });
    }
  }, [view]);

  const showingSummary = messages.results.showing
    .replace('{shown}', String(spots.length))
    .replace('{total}', String(total));

  const changeView = (nextView: HuntView) => {
    startTransition(() => setView(nextView));
  };

  return (
    <div className="space-y-5">
      <HuntFinderControls context={context} displayedInfo={displayedInfo} filters={filters} locale={locale} locations={locations} setDisplayedInfo={setDisplayedInfo} setFilters={setFilters} teamWarAvailable={teamCaughtFamilyKeys !== undefined} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" aria-label="Group hunt results by" role="group">
          {([['location', messages.results.location], ['pokemon', messages.results.pokemon]] as const).map(([value, label]) => (
            <button aria-pressed={view === value} className={`rounded-full px-4 py-2 text-sm font-semibold ${view === value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'}`} key={value} onClick={() => changeView(value)} type="button">{label}</button>
          ))}
        </div>
        <button className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700" disabled={visibleLocationKeys.length === 0} onClick={toggleAllLocations} type="button">
          <span aria-hidden="true">{allLocationsOpen ? '-' : '+'}</span>{' '}{allLocationsOpen ? messages.results.collapseAll : messages.results.openAll}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <p>{showingSummary}</p>
        {isRefreshing && <p aria-live="polite" role="status">{messages.results.refreshing}</p>}
      </div>
      {error && <p role="alert" className="text-rose-600">{error}</p>}
      {isInitialLoading ? (
        <HuntResultsSkeleton label={messages.results.loading} />
      ) : (
        <HuntResults
          collapsedLocations={collapsedLocations}
          context={context}
          displayedInfo={displayedInfo}
          locationGroups={locationGroups}
          locale={locale}
          onQueue={onQueue}
          onToggleLocation={toggleLocation}
          participants={participants}
          pokemonLocationGroups={pokemonLocationGroups}
          sort={appliedFilters.sort}
          sortDirection={appliedFilters.sortDirection}
          spots={spots}
          view={view}
        />
      )}
      {!isInitialLoading && spots.length < total && (
        <div className="flex flex-col items-center gap-2">
          <button className="btn btn-secondary px-5 py-2 disabled:cursor-wait disabled:opacity-60" disabled={isLoadingMore || isRefreshing} onClick={loadMore} type="button">
            {isLoadingMore ? messages.results.loadingMore : messages.results.loadMore}
          </button>
          {loadMoreError && <p className="text-sm text-rose-600" role="alert">{loadMoreError}</p>}
        </div>
      )}
    </div>
  );
}
