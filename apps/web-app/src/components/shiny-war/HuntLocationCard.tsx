import { useState } from 'react';
import HuntSpotCard from './HuntSpotCard';
import type { HuntSpecies, HuntSpot, ParticipantHunts } from './types';

type Props = {
  participants: ParticipantHunts[];
  spots: HuntSpot[];
  targetSpecies?: HuntSpecies;
  locationOpen: boolean;
  onQueue: (spot: HuntSpot, current: boolean, targetSpecies?: HuntSpecies, title?: string) => void;
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
  locationOpen, participants, spots, targetSpecies, onQueue, onToggleLocation,
}: Props) {
  const [lowerRateOpen, setLowerRateOpen] = useState(false);
  const titles = splitTitles(spots);
  const titledSpots = spots.map((spot, index) => ({ spot, title: titles[index] }));
  const bestPointsPerHour = Math.max(...spots.map((spot) => spot.pointsPerHour ?? Number.NEGATIVE_INFINITY));
  const bestSpots = titledSpots.filter(({ spot }) => (spot.pointsPerHour ?? Number.NEGATIVE_INFINITY) === bestPointsPerHour);
  const lowerRateSpots = titledSpots.filter(({ spot }) => (spot.pointsPerHour ?? Number.NEGATIVE_INFINITY) < bestPointsPerHour);
  const firstSpot = bestSpots[0]?.spot || spots[0];

  const renderSpot = ({ spot, title }: typeof titledSpots[number]) => (
    <HuntSpotCard
      key={spot.spot_key}
      participants={participants}
      spot={spot}
      targetSpecies={targetSpecies}
      title={title}
      onQueue={onQueue}
    />
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <header className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:flex-nowrap">
        <button
          aria-expanded={locationOpen}
          className="min-w-0 flex-1 rounded-lg text-left transition-colors hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:hover:text-primary-300"
          onClick={onToggleLocation}
          type="button"
        >
          <span className="block text-lg font-bold leading-tight text-gray-950 dark:text-white">{firstSpot.location}</span>
          <span className="mt-0.5 block text-xs font-semibold text-primary-600 dark:text-primary-300">
            {firstSpot.region} · {spots.length} encounter {spots.length === 1 ? 'split' : 'splits'}
          </span>
        </button>
        <button
          aria-expanded={locationOpen}
          aria-label={`${locationOpen ? 'Collapse' : 'Expand'} ${firstSpot.location}`}
          className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700 transition-colors hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-primary-950 dark:text-primary-200 dark:hover:bg-primary-900"
          onClick={onToggleLocation}
          type="button"
        >
          <span aria-hidden="true">{locationOpen ? '−' : '+'}</span>
        </button>
      </header>
      {locationOpen && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {bestSpots.map(renderSpot)}
          {lowerRateSpots.length > 0 && (
            <section>
              <button
                aria-expanded={lowerRateOpen}
                className="flex w-full items-center justify-between gap-3 bg-gray-50 px-4 py-2.5 text-left text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 dark:bg-gray-950/50 dark:text-gray-300 dark:hover:bg-gray-800"
                onClick={() => setLowerRateOpen((open) => !open)}
                type="button"
              >
                <span>
                  {lowerRateOpen ? 'Hide' : 'Show'} {lowerRateSpots.length} lower points/hour {lowerRateSpots.length === 1 ? 'split' : 'splits'}
                </span>
                <span aria-hidden="true" className="text-base text-primary-600 dark:text-primary-300">
                  {lowerRateOpen ? '−' : '+'}
                </span>
              </button>
              {lowerRateOpen && (
                <div className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-800 dark:border-gray-800">
                  {lowerRateSpots.map(renderSpot)}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </article>
  );
}
