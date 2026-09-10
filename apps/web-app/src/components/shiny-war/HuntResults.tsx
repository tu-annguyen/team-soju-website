import { memo, useCallback, useMemo, useState } from 'react';
import HuntLocationCard from './HuntLocationCard';
import SpeciesSpriteName from './SpeciesSpriteName';
import { groupHuntSpotsByLocation, type HuntLocationGroup } from './huntLocationGroups';
import { groupHuntSpotsByPokemonLocation, type HuntPokemonLocationSection } from './huntPokemonLocationGroups';
import type { HuntSpecies, HuntSpot, ParticipantHunts } from './types';
import type { DisplayedPokemonInfo, HuntFinderContext, HuntSort, SortDirection } from '../hunt-finder/types';
import { getHuntFinderMessages } from '../hunt-finder/messages';
import { getGameTranslations } from '../../utils/gameTranslations';

export type HuntView = 'location' | 'pokemon';

type Props = {
  /** @deprecated Encounter compositions are always visible while their location is open. */
  expanded?: ReadonlySet<string>;
  participants: ParticipantHunts[];
  context?: HuntFinderContext;
  displayedInfo?: DisplayedPokemonInfo[];
  minimumTier?: string;
  locationGroups?: HuntLocationGroup[];
  locale?: string;
  speciesFilter?: string;
  spots: HuntSpot[];
  view: HuntView;
  pokemonLocationGroups?: HuntPokemonLocationSection[];
  onQueue?: (spot: HuntSpot, current: boolean, targetSpecies?: HuntSpecies, title?: string) => void;
  sort?: HuntSort;
  sortDirection?: SortDirection;
  /** @deprecated Encounter compositions no longer toggle independently. */
  onToggle?: (spotKey: string) => void;
  collapsedLocations?: ReadonlySet<string>;
  onToggleLocation?: (locationKey: string) => void;
};

function HuntResults({
  participants, minimumTier = '', locale, speciesFilter = '', spots, view, onQueue,
  collapsedLocations, onToggleLocation, context = 'shinyWar', displayedInfo = [],
  sort = 'pointsPerHour', sortDirection = 'desc', locationGroups: providedLocationGroups,
  pokemonLocationGroups: providedPokemonLocationGroups,
}: Props) {
  const [internalCollapsedLocations, setInternalCollapsedLocations] = useState<Set<string>>(() => new Set());
  const messages = useMemo(() => getHuntFinderMessages(locale).results, [locale]);
  const game = useMemo(() => getGameTranslations(locale), [locale]);
  const effectiveCollapsedLocations = collapsedLocations || internalCollapsedLocations;
  const internalToggleLocation = useCallback((locationKey: string) => {
    setInternalCollapsedLocations((current) => {
      const next = new Set(current);
      if (next.has(locationKey)) next.delete(locationKey);
      else next.add(locationKey);
      return next;
    });
  }, []);
  const toggleLocation = onToggleLocation || internalToggleLocation;
  const locationGroups = useMemo(
    () => providedLocationGroups || groupHuntSpotsByLocation(spots),
    [providedLocationGroups, spots]
  );
  const pokemonLocationGroups = useMemo(
    () => providedPokemonLocationGroups || groupHuntSpotsByPokemonLocation(
      spots, speciesFilter, minimumTier, sort, sortDirection
    ),
    [minimumTier, providedPokemonLocationGroups, sort, sortDirection, speciesFilter, spots]
  );
  if (view === 'location') {
    return (
      <div className="space-y-3">
        {locationGroups.map((group) => (
          <HuntLocationCard
            key={group.key}
            locationOpen={!effectiveCollapsedLocations.has(group.key)}
            participants={participants}
            locale={locale}
            spots={group.spots}
            context={context}
            displayedInfo={displayedInfo}
            sort={sort}
            sortDirection={sortDirection}
            onQueue={onQueue}
            locationKey={group.key}
            onToggleLocation={toggleLocation}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pokemonLocationGroups.map(({ species, spots: speciesSpots, locations }) => {
        const wildLocationCount = new Set(
          speciesSpots.map((spot) => `${spot.region}|${spot.location}`)
        ).size;
        return (
        <section
          className="[content-visibility:auto] [contain-intrinsic-size:auto_500px] rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-950"
          key={`${species.slug}-${species.form}`}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg leading-none font-bold text-gray-950 dark:text-white">
                <SpeciesSpriteName displayName={game.species(species.name)} form={species.form} name={species.name} slug={species.slug} />
              </h2>
              <span className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-800 dark:bg-primary-950 dark:text-primary-200">
                {game.tier(species.tier)}
              </span>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                {species.points} {species.points === 1 ? messages.point : messages.points}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {wildLocationCount}{' '}
              {wildLocationCount === 1 ? messages.wildLocation : messages.wildLocations}
            </p>
          </div>
          <div className="space-y-3">
            {locations.map((group) => (
              <HuntLocationCard
                key={`${species.slug}-${species.form}-${group.key}`}
                locationOpen={!effectiveCollapsedLocations.has(group.key)}
                participants={participants}
                locale={locale}
                spots={group.spots}
                context={context}
                displayedInfo={displayedInfo}
                sort={sort}
                sortDirection={sortDirection}
                targetSpecies={species}
                onQueue={onQueue}
                locationKey={group.key}
                onToggleLocation={toggleLocation}
              />
            ))}
          </div>
        </section>
      )})}
    </div>
  );
}

export default memo(HuntResults);
