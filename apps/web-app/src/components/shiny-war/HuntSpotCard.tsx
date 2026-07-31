import SpeciesSpriteName from './SpeciesSpriteName';
import type { HuntSpecies, HuntSpot } from './types';

type Props = {
  spot: HuntSpot;
  expanded: boolean;
  nested?: boolean;
  targetSpecies?: HuntSpecies;
  onQueue: (spot: HuntSpot, current: boolean, targetSpecies?: HuntSpecies) => void;
  onToggle: () => void;
};

export default function HuntSpotCard({ spot, expanded, nested = false, targetSpecies, onQueue, onToggle }: Props) {
  return (
    <article className={`border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 ${nested ? 'rounded-xl' : 'rounded-2xl'}`}>
      <div className="grid grid-cols-2 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <button
          aria-expanded={expanded}
          className="col-span-full min-w-0 text-left lg:col-span-1"
          onClick={onToggle}
        >
          <h3 className="font-bold text-gray-950 dark:text-white">{spot.location}</h3>
          <p className="truncate whitespace-nowrap text-sm text-gray-500">
            {spot.region} · {spot.season} {spot.time} · {spot.horde_size ? `${spot.horde_size}× Sweet Scent` : spot.method}
            {spot.is_lure && <span className="font-semibold text-amber-600 dark:text-amber-400"> · Includes Lure-only encounters</span>}
          </p>
        </button>
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
        <div className="col-span-full grid grid-cols-2 gap-2 lg:flex">
          <button className="btn btn-secondary w-full whitespace-nowrap text-sm" onClick={() => onQueue(spot, false, targetSpecies)}>Queue</button>
          <button className="btn btn-primary w-full whitespace-nowrap text-sm" onClick={() => onQueue(spot, true, targetSpecies)}>Hunt now</button>
        </div>
      </div>
      {expanded && (
        <div className="mt-4 grid gap-2 border-t border-gray-100 pt-4 dark:border-gray-800 sm:grid-cols-2">
          {spot.composition.map((species) => (
            <p key={`${species.slug}-${species.form}`} className="flex items-center text-sm text-gray-700 dark:text-gray-300">
              <SpeciesSpriteName
                className="font-bold"
                form={species.form}
                name={species.name}
                slug={species.slug}
              />
              <span>&nbsp;· {(species.split * 100).toFixed(2)}% · {species.tier} · Lv. {species.min_level}–{species.max_level}</span>
              {species.is_lure && <span className="ml-1 font-semibold text-amber-600 dark:text-amber-400">· Lure only</span>}
            </p>
          ))}
          <p className="text-xs text-gray-500 sm:col-span-2">
            {spot.encountersPerHour === null
              ? 'No reliable encounters/hour data'
              : `${spot.encountersPerHour.toLocaleString()} encounters/hour · 1/${spot.denominator.toLocaleString()} effective odds`}
          </p>
        </div>
      )}
    </article>
  );
}
