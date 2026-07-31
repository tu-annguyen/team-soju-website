import HuntSpotCard from './HuntSpotCard';
import type { HuntSpecies, HuntSpot, ParticipantHunts } from './types';

type Props = {
  expanded: ReadonlySet<string>;
  participants: ParticipantHunts[];
  selectedSeason?: string;
  selectedTime?: string;
  spots: HuntSpot[];
  targetSpecies?: HuntSpecies;
  onQueue: (spot: HuntSpot, current: boolean, targetSpecies?: HuntSpecies) => void;
  onSeasonChange?: (season: string) => void;
  onTimeChange?: (time: string) => void;
  onToggle: (spotKey: string) => void;
};

const SINGLE_METHODS = new Set(['Grass', 'Cave', 'Water', 'Inside', 'Dark Grass', 'Dust Cloud', 'Shadow']);
const SWEET_SCENT_TERRAINS = new Set(['Grass', 'Dark Grass', 'Water', 'Cave', 'Inside']);

function encounterType(spot: HuntSpot) {
  if (spot.horde_size) {
    return SWEET_SCENT_TERRAINS.has(spot.method)
      ? `Sweet Scent ${spot.method}`
      : 'Sweet Scent';
  }
  if (SINGLE_METHODS.has(spot.method)) return `Singles ${spot.method}`;
  return spot.method;
}

function splitTitles(spots: HuntSpot[]) {
  const totals = new Map<string, number>();
  spots.forEach((spot) => {
    const type = encounterType(spot);
    totals.set(type, (totals.get(type) || 0) + 1);
  });
  const occurrences = new Map<string, number>();
  return spots.map((spot) => {
    const type = encounterType(spot);
    const occurrence = (occurrences.get(type) || 0) + 1;
    occurrences.set(type, occurrence);
    const needsSplitNumber = (totals.get(type) || 0) > 1;
    const label = needsSplitNumber ? `${type} split ${occurrence}` : type;
    const areas = spot.location_areas?.filter(Boolean) || [];
    return areas.length ? `${areas.join(', ')} · ${label}` : label;
  });
}

export default function HuntLocationCard({
  expanded, participants, selectedSeason, selectedTime, spots, targetSpecies,
  onQueue, onSeasonChange, onTimeChange, onToggle,
}: Props) {
  const firstSpot = spots[0];
  const titles = splitTitles(spots);
  const allExpanded = spots.every((spot) => expanded.has(spot.spot_key));
  const toggleAvailablePokemon = () => {
    spots.forEach((spot) => {
      if (allExpanded ? expanded.has(spot.spot_key) : !expanded.has(spot.spot_key)) {
        onToggle(spot.spot_key);
      }
    });
  };
  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <button
        aria-expanded={allExpanded}
        className="flex w-full items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 text-left transition-colors hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 dark:border-gray-800 dark:hover:bg-primary-950/40"
        onClick={toggleAvailablePokemon}
        type="button"
      >
        <span>
          <span className="block text-xl font-bold text-gray-950 dark:text-white">{firstSpot.location}</span>
          <span className="mt-1 block text-sm font-semibold text-primary-600 dark:text-primary-300">
            Pokémon available · {firstSpot.region} · {spots.length} encounter {spots.length === 1 ? 'split' : 'splits'}
          </span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xl font-bold text-primary-700 dark:bg-primary-950 dark:text-primary-200" aria-hidden="true">
          {allExpanded ? '−' : '+'}
        </span>
      </button>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {spots.map((spot, index) => (
          <HuntSpotCard
            embedded
            expanded={expanded.has(spot.spot_key)}
            key={spot.spot_key}
            participants={participants}
            selectedSeason={selectedSeason}
            selectedTime={selectedTime}
            spot={spot}
            targetSpecies={targetSpecies}
            title={titles[index]}
            onQueue={onQueue}
            onSeasonChange={onSeasonChange}
            onTimeChange={onTimeChange}
            onToggle={() => onToggle(spot.spot_key)}
          />
        ))}
      </div>
    </article>
  );
}
