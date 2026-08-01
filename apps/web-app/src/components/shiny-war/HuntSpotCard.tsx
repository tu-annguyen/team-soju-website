import SpeciesSpriteName from './SpeciesSpriteName';
import LocationQueueStatus from './LocationQueueStatus';
import HuntFilterChips from './HuntFilterChips';
import type { HuntSpecies, HuntSpot, ParticipantHunts } from './types';

type Props = {
  spot: HuntSpot;
  expanded: boolean;
  nested?: boolean;
  participants: ParticipantHunts[];
  targetSpecies?: HuntSpecies;
  onQueue: (spot: HuntSpot, current: boolean, targetSpecies?: HuntSpecies, title?: string) => void;
  onToggle: () => void;
  selectedSeason?: string;
  selectedTime?: string;
  onSeasonChange?: (season: string) => void;
  onTimeChange?: (time: string) => void;
  embedded?: boolean;
  title?: string;
};

export default function HuntSpotCard({
  spot, expanded, nested = false, participants, targetSpecies, onQueue, onToggle,
  selectedSeason, selectedTime, onSeasonChange, onTimeChange,
  embedded = false, title,
}: Props) {
  return (
    <article className={embedded
      ? 'bg-transparent p-5'
      : `border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 ${nested ? 'rounded-xl' : 'rounded-2xl'}`}
    >
      <div className="grid grid-cols-2 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="col-span-full min-w-0 lg:col-span-1">
          <button
            aria-expanded={expanded}
            className="w-full text-left"
            onClick={onToggle}
          >
            <h3 className="font-bold text-gray-950 dark:text-white">{title || spot.location}</h3>
            <p className="truncate whitespace-nowrap text-sm text-gray-500">
              {spot.region} · {spot.horde_size ? `${spot.horde_size}× Sweet Scent` : spot.method}
              {spot.is_lure && <span className="font-semibold text-amber-600 dark:text-amber-400"> · Includes Lure-only encounters</span>}
            </p>
          </button>
          <HuntFilterChips
            season={spot.season}
            selectedSeason={selectedSeason}
            selectedTime={selectedTime}
            time={spot.time}
            times={spot.times}
            onSeasonChange={onSeasonChange}
            onTimeChange={onTimeChange}
          />
        </div>
        <div className="col-span-full grid grid-cols-2 gap-4 lg:contents">
          <div className="lg:text-right">
            <strong className="text-xl text-primary-600">{spot.pointsPerHour === null ? 'N/A' : spot.pointsPerHour.toFixed(3)}</strong>
            <p className="text-xs text-gray-500">points/hour</p>
          </div>
          <div className="text-right">
            <strong>{spot.averagePoints.toFixed(2)}</strong>
            <p className="text-xs text-gray-500">average/shiny</p>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="mt-4 grid gap-2 border-t border-gray-100 pt-4 dark:border-gray-800 sm:grid-cols-2">
          {spot.composition.map((species) => (
            <p key={`${species.slug}-${species.form}`} className="flex flex-wrap items-center text-sm text-gray-700 sm:flex-nowrap dark:text-gray-300">
              <SpeciesSpriteName
                className="font-bold"
                form={species.form}
                name={species.name}
                slug={species.slug}
              />
              <span className="basis-full pl-10 sm:basis-auto sm:pl-0">
                <span className="hidden sm:inline">&nbsp;· </span>
                {(species.split * 100).toFixed(2)}% · {species.tier} · Lv. {species.min_level}–{species.max_level}
                {species.is_lure && <span className="ml-1 font-semibold text-amber-600 dark:text-amber-400">· Lure only</span>}
              </span>
            </p>
          ))}
          <p className="text-xs text-gray-500 sm:col-span-2">
            {spot.encountersPerHour === null
              ? 'No reliable encounters/hour data'
              : `${spot.encountersPerHour.toLocaleString()} encounters/hour · 1/${spot.denominator.toLocaleString()} effective odds`}
          </p>
        </div>
      )}
      <LocationQueueStatus participants={participants} spot={spot} />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn btn-secondary w-full whitespace-nowrap text-sm" onClick={() => onQueue(spot, false, targetSpecies, title)}>Queue</button>
        <button className="btn btn-primary w-full whitespace-nowrap text-sm" onClick={() => onQueue(spot, true, targetSpecies, title)}>Hunt now</button>
      </div>
    </article>
  );
}
