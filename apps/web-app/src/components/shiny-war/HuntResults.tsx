import { useState } from 'react';
import { groupHuntSpotsByPokemon } from './huntGroups';
import HuntLocationCard from './HuntLocationCard';
import SpeciesSpriteName from './SpeciesSpriteName';
import { groupHuntSpotsByLocation } from './huntLocationGroups';
import type { HuntSpecies, HuntSpot, ParticipantHunts, PokemonHuntGroup } from './types';

export type HuntView = 'location' | 'pokemon';

type Props = {
  caughtFamilyKeys?: string[];
  expanded: ReadonlySet<string>;
  participants: ParticipantHunts[];
  speciesFilter: string;
  spots: HuntSpot[];
  view: HuntView;
  onQueue: (spot: HuntSpot, current: boolean, targetSpecies?: HuntSpecies, title?: string) => void;
  onToggle: (spotKey: string) => void;
  selectedSeason?: string;
  selectedTime?: string;
  onSeasonChange?: (season: string) => void;
  onTimeChange?: (time: string) => void;
  collapsedLocations?: ReadonlySet<string>;
  onToggleLocation?: (locationKey: string) => void;
};

export default function HuntResults({
  caughtFamilyKeys = [], expanded, participants, speciesFilter, spots, view, onQueue, onToggle,
  selectedSeason, selectedTime, onSeasonChange, onTimeChange,
  collapsedLocations, onToggleLocation,
}: Props) {
  const caughtFamilyKeySet = new Set(caughtFamilyKeys.map(normalizeSpeciesKey));
  const [internalCollapsedLocations, setInternalCollapsedLocations] = useState<Set<string>>(() => new Set());
  const effectiveCollapsedLocations = collapsedLocations || internalCollapsedLocations;
  const toggleLocation = onToggleLocation || ((locationKey: string) => {
    setInternalCollapsedLocations((current) => {
      const next = new Set(current);
      if (next.has(locationKey)) next.delete(locationKey);
      else next.add(locationKey);
      return next;
    });
  });
  if (view === 'location') {
    const locationGroups = prioritizeUncaught(
      groupHuntSpotsByLocation(spots),
      (group) => hasCaughtSpecies(group.spots, caughtFamilyKeySet),
    );
    return (
      <div className="space-y-3">
        {locationGroups.map((group) => (
          <HuntLocationCard
            expanded={expanded}
            key={group.key}
            locationOpen={!effectiveCollapsedLocations.has(group.key)}
            participants={participants}
            selectedSeason={selectedSeason}
            selectedTime={selectedTime}
            spots={group.spots}
            onQueue={onQueue}
            onSeasonChange={onSeasonChange}
            onTimeChange={onTimeChange}
            onToggle={onToggle}
            onToggleLocation={() => toggleLocation(group.key)}
          />
        ))}
      </div>
    );
  }

  const groups = prioritizePokemonGroups(
    groupHuntSpotsByPokemon(spots, speciesFilter),
    caughtFamilyKeySet,
  );

  return (
    <div className="space-y-4">
      {groups.map(({ species, spots: speciesSpots }) => (
        <section
          className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-950"
          key={`${species.slug}-${species.form}`}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg leading-none font-bold text-gray-950 dark:text-white">
                <SpeciesSpriteName form={species.form} name={species.name} slug={species.slug} />
              </h2>
              <span className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-800 dark:bg-primary-950 dark:text-primary-200">
                {species.tier}
              </span>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                {species.points} {species.points === 1 ? 'point' : 'points'}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {new Set(speciesSpots.map((spot) => `${spot.region}|${spot.location}`)).size}{' '}
              {new Set(speciesSpots.map((spot) => `${spot.region}|${spot.location}`)).size === 1 ? 'wild location' : 'wild locations'}
            </p>
          </div>
          <div className="space-y-3">
            {prioritizeUncaught(
              groupHuntSpotsByLocation(speciesSpots),
              (group) => hasCaughtSpecies(group.spots, caughtFamilyKeySet),
            ).map((group) => (
              <HuntLocationCard
                expanded={expanded}
                key={`${species.slug}-${species.form}-${group.key}`}
                locationOpen={!effectiveCollapsedLocations.has(group.key)}
                participants={participants}
                selectedSeason={selectedSeason}
                selectedTime={selectedTime}
                spots={group.spots}
                targetSpecies={species}
                onQueue={onQueue}
                onSeasonChange={onSeasonChange}
                onTimeChange={onTimeChange}
                onToggle={onToggle}
                onToggleLocation={() => toggleLocation(group.key)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const normalizeSpeciesKey = (value: string) => value.trim().toLowerCase().replace(/[ .]+/g, '-');

function hasCaughtSpecies(spots: HuntSpot[], caughtFamilyKeys: ReadonlySet<string>) {
  return spots.some((spot) => spot.composition.some(
    (species) => caughtFamilyKeys.has(normalizeSpeciesKey(species.family_key)),
  ));
}

function prioritizePokemonGroups(
  groups: PokemonHuntGroup[],
  caughtFamilyKeys: ReadonlySet<string>,
) {
  return [...groups].sort((left, right) => {
    const leftCaught = caughtFamilyKeys.has(normalizeSpeciesKey(left.species.family_key));
    const rightCaught = caughtFamilyKeys.has(normalizeSpeciesKey(right.species.family_key));
    if (leftCaught !== rightCaught) return leftCaught ? 1 : -1;

    const leftRate = bestPrioritizedRate(left, caughtFamilyKeys, leftCaught);
    const rightRate = bestPrioritizedRate(right, caughtFamilyKeys, rightCaught);
    if (leftRate !== null || rightRate !== null) {
      if (leftRate === null) return 1;
      if (rightRate === null) return -1;
      if (leftRate !== rightRate) return rightRate - leftRate;
    }

    return right.species.points - left.species.points
      || left.species.name.localeCompare(right.species.name);
  });
}

function bestPrioritizedRate(
  group: PokemonHuntGroup,
  caughtFamilyKeys: ReadonlySet<string>,
  targetCaught: boolean,
) {
  const locationGroups = groupHuntSpotsByLocation(group.spots);
  const prioritizedSpots = targetCaught
    ? group.spots
    : locationGroups
      .filter((locationGroup) => !hasCaughtSpecies(locationGroup.spots, caughtFamilyKeys))
      .flatMap((locationGroup) => locationGroup.spots);
  const rates = prioritizedSpots.flatMap(
    (spot) => spot.pointsPerHour === null ? [] : [spot.pointsPerHour],
  );
  return rates.length ? Math.max(...rates) : null;
}

function prioritizeUncaught<T>(items: T[], isCaught: (item: T) => boolean) {
  return [...items.filter((item) => !isCaught(item)), ...items.filter(isCaught)];
}
