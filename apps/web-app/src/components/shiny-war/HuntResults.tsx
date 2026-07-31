import { groupHuntSpotsByPokemon } from './huntGroups';
import HuntSpotCard from './HuntSpotCard';
import SpeciesSpriteName from './SpeciesSpriteName';
import type { HuntSpecies, HuntSpot } from './types';

export type HuntView = 'location' | 'pokemon';

type Props = {
  expanded: ReadonlySet<string>;
  speciesFilter: string;
  spots: HuntSpot[];
  view: HuntView;
  onQueue: (spot: HuntSpot, current: boolean, targetSpecies?: HuntSpecies) => void;
  onToggle: (spotKey: string) => void;
};

export default function HuntResults({ expanded, speciesFilter, spots, view, onQueue, onToggle }: Props) {
  if (view === 'location') {
    return (
      <div className="space-y-3">
        {spots.map((spot) => (
          <HuntSpotCard
            key={spot.spot_key}
            expanded={expanded.has(spot.spot_key)}
            onQueue={onQueue}
            onToggle={() => onToggle(spot.spot_key)}
            spot={spot}
          />
        ))}
      </div>
    );
  }

  const groups = groupHuntSpotsByPokemon(spots, speciesFilter);

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
            {speciesSpots.map((spot) => (
              <HuntSpotCard
                key={`${species.slug}-${species.form}-${spot.spot_key}`}
                expanded={expanded.has(spot.spot_key)}
                nested
                onQueue={(spotToQueue, current) => onQueue(spotToQueue, current, species)}
                onToggle={() => onToggle(spot.spot_key)}
                spot={spot}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
