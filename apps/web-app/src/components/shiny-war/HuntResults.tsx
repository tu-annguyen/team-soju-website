import { useState } from 'react';
import HuntLocationCard from './HuntLocationCard';
import SpeciesSpriteName from './SpeciesSpriteName';
import { groupHuntSpotsByLocation } from './huntLocationGroups';
import { groupHuntSpotsByPokemonLocation } from './huntPokemonLocationGroups';
import type { HuntSpecies, HuntSpot, ParticipantHunts } from './types';

export type HuntView = 'location' | 'pokemon';

type Props = {
  /** @deprecated Encounter compositions are always visible while their location is open. */
  expanded?: ReadonlySet<string>;
  participants: ParticipantHunts[];
  minimumTier?: string;
  speciesFilter: string;
  spots: HuntSpot[];
  view: HuntView;
  onQueue: (spot: HuntSpot, current: boolean, targetSpecies?: HuntSpecies, title?: string) => void;
  /** @deprecated Encounter compositions no longer toggle independently. */
  onToggle?: (spotKey: string) => void;
  collapsedLocations?: ReadonlySet<string>;
  onToggleLocation?: (locationKey: string) => void;
};

export default function HuntResults({
  participants, minimumTier = '', speciesFilter, spots, view, onQueue,
  collapsedLocations, onToggleLocation,
}: Props) {
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
    const locationGroups = groupHuntSpotsByLocation(spots);
    return (
      <div className="space-y-3">
        {locationGroups.map((group) => (
          <HuntLocationCard
            key={group.key}
            locationOpen={!effectiveCollapsedLocations.has(group.key)}
            participants={participants}
            spots={group.spots}
            onQueue={onQueue}
            onToggleLocation={() => toggleLocation(group.key)}
          />
        ))}
      </div>
    );
  }

  const groups = groupHuntSpotsByPokemonLocation(spots, speciesFilter, minimumTier);

  return (
    <div className="space-y-4">
      {groups.map(({ species, spots: speciesSpots, locations }) => (
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
            {locations.map((group) => (
              <HuntLocationCard
                key={`${species.slug}-${species.form}-${group.key}`}
                locationOpen={!effectiveCollapsedLocations.has(group.key)}
                participants={participants}
                spots={group.spots}
                targetSpecies={species}
                onQueue={onQueue}
                onToggleLocation={() => toggleLocation(group.key)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
