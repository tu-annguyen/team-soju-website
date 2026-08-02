import HuntSpotCard from './HuntSpotCard';
import type { HuntSpecies, HuntSpot, ParticipantHunts } from './types';

type Props = {
  expanded: ReadonlySet<string>;
  participants: ParticipantHunts[];
  selectedSeason?: string;
  selectedTime?: string;
  spots: HuntSpot[];
  targetSpecies?: HuntSpecies;
  locationOpen: boolean;
  onQueue: (spot: HuntSpot, current: boolean, targetSpecies?: HuntSpecies, title?: string) => void;
  onSeasonChange?: (season: string) => void;
  onTimeChange?: (time: string) => void;
  onToggle: (spotKey: string) => void;
  onToggleLocation: () => void;
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
  expanded, locationOpen, participants, selectedSeason, selectedTime, spots, targetSpecies,
  onQueue, onSeasonChange, onTimeChange, onToggle, onToggleLocation,
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
      <header className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <button
          aria-expanded={locationOpen}
          className="min-w-0 flex-1 rounded-lg text-left transition-colors hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:hover:text-primary-300"
          onClick={onToggleLocation}
          type="button"
        >
          <span className="block text-xl font-bold text-gray-950 dark:text-white">{firstSpot.location}</span>
          <span className="mt-1 block text-sm font-semibold text-primary-600 dark:text-primary-300">
            {firstSpot.region} · {spots.length} encounter {spots.length === 1 ? 'split' : 'splits'}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <button
            aria-pressed={allExpanded}
            className="rounded-full border border-primary-300 bg-white px-3 py-2 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-primary-800 dark:bg-gray-900 dark:text-primary-200 dark:hover:bg-primary-950"
            onClick={() => {
              if (!locationOpen) onToggleLocation();
              toggleAvailablePokemon();
            }}
            type="button"
          >
            {allExpanded ? 'Hide Pokemon' : 'Show Pokemon'}
          </button>
          <button
            aria-expanded={locationOpen}
            aria-label={`${locationOpen ? 'Collapse' : 'Expand'} ${firstSpot.location}`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-xl font-bold text-primary-700 transition-colors hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-primary-950 dark:text-primary-200 dark:hover:bg-primary-900"
            onClick={onToggleLocation}
            type="button"
          >
            <span aria-hidden="true">{locationOpen ? '−' : '+'}</span>
          </button>
        </div>
      </header>
      {locationOpen && (
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
      )}
    </article>
  );
}
