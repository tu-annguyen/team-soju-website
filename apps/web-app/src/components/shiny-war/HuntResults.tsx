import { groupHuntSpotsByPokemon } from './huntGroups';
import HuntLocationCard from './HuntLocationCard';
import SpeciesSpriteName from './SpeciesSpriteName';
import { groupHuntSpotsByLocation } from './huntLocationGroups';
import type { HuntSpecies, HuntSpot, ParticipantHunts } from './types';

export type HuntView = 'location' | 'pokemon';

type Props = {
  expanded: ReadonlySet<string>;
  participants: ParticipantHunts[];
  speciesFilter: string;
  spots: HuntSpot[];
  view: HuntView;
  onQueue: (spot: HuntSpot, current: boolean, targetSpecies?: HuntSpecies) => void;
  onToggle: (spotKey: string) => void;
  selectedSeason?: string;
  selectedTime?: string;
  onSeasonChange?: (season: string) => void;
  onTimeChange?: (time: string) => void;
};

export default function HuntResults({
  expanded, participants, speciesFilter, spots, view, onQueue, onToggle,
  selectedSeason, selectedTime, onSeasonChange, onTimeChange,
}: Props) {
  if (view === 'location') {
    const locationGroups = groupHuntSpotsByLocation(spots);
    return (
      <div className="space-y-3">
        {locationGroups.map((group) => (
          <HuntLocationCard
            expanded={expanded}
            key={group.key}
            participants={participants}
            selectedSeason={selectedSeason}
            selectedTime={selectedTime}
            spots={group.spots}
            onQueue={onQueue}
            onSeasonChange={onSeasonChange}
            onTimeChange={onTimeChange}
            onToggle={onToggle}
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
            {groupHuntSpotsByLocation(speciesSpots).map((group) => (
              <HuntLocationCard
                expanded={expanded}
                key={`${species.slug}-${species.form}-${group.key}`}
                participants={participants}
                selectedSeason={selectedSeason}
                selectedTime={selectedTime}
                spots={group.spots}
                targetSpecies={species}
                onQueue={onQueue}
                onSeasonChange={onSeasonChange}
                onTimeChange={onTimeChange}
                onToggle={onToggle}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
