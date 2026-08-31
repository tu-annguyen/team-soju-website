import SpeciesSpriteName from './SpeciesSpriteName';
import LocationQueueStatus from './LocationQueueStatus';
import HuntFilterChips from './HuntFilterChips';
import type { HuntSpecies, HuntSpot, ParticipantHunts } from './types';
import type { HuntFinderContext, HuntSort } from '../hunt-finder/types';
import { getHuntFinderMessages } from '../hunt-finder/messages';

type Props = {
  spot: HuntSpot;
  participants: ParticipantHunts[];
  locale?: string;
  context?: HuntFinderContext;
  targetSpecies?: HuntSpecies;
  onQueue?: (spot: HuntSpot, current: boolean, targetSpecies?: HuntSpecies, title?: string) => void;
  sort?: HuntSort;
  selectedSeason?: string;
  selectedTime?: string;
  onSeasonChange?: (season: string) => void;
  onTimeChange?: (time: string) => void;
  title?: string;
};

export default function HuntSpotCard({
  spot, participants, locale, targetSpecies, onQueue, title, context = 'shinyWar', sort = 'pointsPerHour',
  selectedSeason = '', selectedTime = '', onSeasonChange, onTimeChange,
}: Props) {
  const availableTimes = spot.time === 'Any' ? [] : (spot.times?.length ? spot.times : [spot.time]);
  const availability = [
    spot.season !== 'Any' ? spot.season : null,
    ...availableTimes.map((time) => time.charAt(0).toUpperCase() + time.slice(1)),
  ].filter(Boolean).join(' · ');
  const showingExp = sort === 'expPerHour';
  const messages = getHuntFinderMessages(locale).results;
  const evLabels = (species: HuntSpecies) => ([
    ['HP', species.ev_hp], ['Atk', species.ev_attack], ['Def', species.ev_defense],
    ['Sp. Atk', species.ev_sp_attack], ['Sp. Def', species.ev_sp_defense], ['Speed', species.ev_speed],
  ] as const).filter(([, value]) => Number(value) > 0).map(([label, value]) => `${label} +${value}`).join(', ');

  return (
    <article className="bg-transparent px-4 py-3">
      <div className="grid grid-cols-2 items-start gap-x-4 gap-y-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <div className="col-span-full min-w-0 lg:col-span-1">
          <div className="w-full text-left">
            <h3 className="text-sm font-bold text-gray-950 dark:text-white">{title || spot.location}</h3>
            <p className="truncate whitespace-nowrap text-xs text-gray-500">
              {spot.region} · {spot.horde_size ? `${spot.horde_size}× Sweet Scent` : spot.method}
              {availability && <> · {availability}</>}
              {spot.is_lure && <span className="font-semibold text-amber-600 dark:text-amber-400"> · {messages.includesLure}</span>}
              {spot.is_special && <span className="font-semibold text-sky-600 dark:text-sky-400"> · {messages.includesSpecial}</span>}
            </p>
          </div>
          {(onSeasonChange || onTimeChange) && (
            <HuntFilterChips
              season={spot.season}
              selectedSeason={selectedSeason}
              selectedTime={selectedTime}
              time={spot.time}
              times={spot.times}
              onSeasonChange={onSeasonChange}
              onTimeChange={onTimeChange}
            />
          )}
        </div>
        <div className="col-span-full grid grid-cols-2 gap-4 lg:contents">
          <div className="lg:text-right">
            <strong className="text-lg text-primary-600">
              {showingExp
                ? (spot.expPerHour == null ? 'N/A' : Math.round(spot.expPerHour).toLocaleString())
                : (spot.pointsPerHour === null ? 'N/A' : spot.pointsPerHour.toFixed(3))}
            </strong>
            <p className="text-xs text-gray-500">{showingExp ? 'EXP/hour' : 'points/hour'}</p>
          </div>
          <div className="text-right">
            <strong>{showingExp ? Math.round(spot.averageExp || 0).toLocaleString() : spot.averagePoints.toFixed(2)}</strong>
            <p className="text-xs text-gray-500">{showingExp ? messages.averageExp : messages.averageShiny}</p>
          </div>
        </div>
        {context === 'shinyWar' && onQueue && (
          <div className="col-span-full flex items-center justify-end gap-2 lg:col-span-1">
            <button className="btn btn-secondary whitespace-nowrap px-4 py-2 text-sm" onClick={() => onQueue(spot, false, targetSpecies, title)}>{messages.queue}</button>
            <button className="btn btn-primary whitespace-nowrap px-4 py-2 text-sm" onClick={() => onQueue(spot, true, targetSpecies, title)}>{messages.huntNow}</button>
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 border-t border-gray-100 pt-3 dark:border-gray-800 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {spot.composition.map((species) => (
          <p key={`${species.slug}-${species.form}`} className="flex min-w-0 flex-wrap items-center text-xs text-gray-700 dark:text-gray-300">
            <SpeciesSpriteName
              className="font-bold"
              form={species.form}
              name={species.name}
              slug={species.slug}
            />
            <span className="basis-full pl-10 sm:basis-auto sm:pl-0">
              <span className="hidden sm:inline">&nbsp;· </span>
              {species.rate_unknown
                ? <span aria-label="Unknown encounter rate">???</span>
                : species.is_special
                  ? <span className="font-semibold text-sky-600 dark:text-sky-400">{messages.special}</span>
                : `${(species.split * 100).toFixed(2)}%`} · {species.tier} · Lv. {species.min_level}–{species.max_level}
              {evLabels(species) && <span className="ml-1 text-emerald-700 dark:text-emerald-300">· {evLabels(species)} EV</span>}
              {species.is_lure && <span className="ml-1 font-semibold text-amber-600 dark:text-amber-400">· {messages.lureOnly}</span>}
            </span>
          </p>
        ))}
        <p className="text-xs text-gray-500 sm:col-span-2 lg:col-span-3 2xl:col-span-4">
          {spot.encountersPerHour === null
            ? messages.noHourly
            : `${spot.encountersPerHour.toLocaleString()} ${messages.encountersHour} · 1/${spot.denominator.toLocaleString()} ${messages.effectiveOdds}`}
        </p>
      </div>
      {context === 'shinyWar' && <LocationQueueStatus participants={participants} spot={spot} />}
    </article>
  );
}
