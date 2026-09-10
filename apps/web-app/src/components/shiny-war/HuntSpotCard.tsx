import { Fragment } from 'react';
import { SpeciesSprite } from './SpeciesSpriteName';
import LocationQueueStatus from './LocationQueueStatus';
import ClockAttributeIcon from './ClockAttributeIcon';
import type { HuntSpecies, HuntSpot, ParticipantHunts } from './types';
import type { DisplayedPokemonInfo, HuntFinderContext, HuntSort } from '../hunt-finder/types';
import { getHuntFinderMessages } from '../hunt-finder/messages';
import { getGameTranslations } from '../../utils/gameTranslations';

type Props = {
  spot: HuntSpot;
  participants: ParticipantHunts[];
  locale?: string;
  context?: HuntFinderContext;
  displayedInfo?: DisplayedPokemonInfo[];
  targetSpecies?: HuntSpecies;
  onQueue?: (spot: HuntSpot, current: boolean, targetSpecies?: HuntSpecies, title?: string) => void;
  sort?: HuntSort;
  title?: string;
};

export default function HuntSpotCard({
  spot, participants, locale, targetSpecies, onQueue, title, context = 'shinyWar', displayedInfo = [], sort = 'pointsPerHour',
}: Props) {
  const availableTimes = spot.time === 'Any' ? [] : (spot.times?.length ? spot.times : [spot.time]);
  const game = getGameTranslations(locale);
  const availability = [
    ...(spot.season !== 'Any'
      ? [{ kind: 'season' as const, label: game.label(spot.season), value: spot.season }]
      : []),
    ...availableTimes.map((time) => {
      const value = time.charAt(0).toUpperCase() + time.slice(1);
      return { kind: 'timeOfDay' as const, label: game.label(value), value };
    }),
  ];
  const showingExp = sort === 'expPerHour';
  const showPointsPerHour = sort === 'pointsPerHour' || displayedInfo.includes('pointsPerHour');
  const showAverageShiny = sort === 'pointsPerHour' || displayedInfo.includes('averageShiny');
  const showEncountersPerHour = sort === 'pointsPerHour' || displayedInfo.includes('encountersPerHour');
  const showEffectiveOdds = sort === 'pointsPerHour' || displayedInfo.includes('effectiveOdds');
  const showTier = sort !== 'alphabetical' || displayedInfo.includes('tier');
  const showLevel = showingExp || displayedInfo.includes('level');
  const showEvYield = showingExp || displayedInfo.includes('evYield');
  const showEggGroups = showingExp || displayedInfo.includes('eggGroups');
  const copy = getHuntFinderMessages(locale);
  const messages = copy.results;
  const evLabels = (species: HuntSpecies) => ([
    ['HP', species.ev_hp], ['Atk', species.ev_attack], ['Def', species.ev_defense],
    ['Sp. Atk', species.ev_sp_attack], ['Sp. Def', species.ev_sp_defense], ['Speed', species.ev_speed],
  ] as const).filter(([, value]) => Number(value) > 0).map(([label, value]) => `${game.label(label)} +${value}`).join(', ');

  return (
    <article className="bg-transparent px-4 py-3">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1 basis-full lg:basis-64">
          <div className="w-full text-left">
            <h3 className="text-sm font-bold text-gray-950 dark:text-white">{title || spot.location}</h3>
            <p className="truncate whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
              {game.region(spot.region)} · {spot.horde_size ? `${spot.horde_size}× ${game.label('Sweet Scent')}` : game.label(spot.method)}
              {availability.map(({ kind, label, value }) => (
                <Fragment key={`${kind}-${value}`}>
                  {' · '}<ClockAttributeIcon className="mr-1 align-[-0.125em]" kind={kind} size="sm" value={value} />{label}
                </Fragment>
              ))}
              {spot.is_lure && <span className="font-semibold text-amber-600 dark:text-amber-400"> · {messages.includesLure}</span>}
              {spot.is_special && <span className="font-semibold text-sky-600 dark:text-sky-400"> · {messages.includesSpecial}</span>}
            </p>
          </div>
        </div>
        {(showingExp || showPointsPerHour || showAverageShiny) && (
          <div className="flex flex-wrap items-start justify-end gap-6">
            {showingExp && <>
            <div className="text-right">
              <strong className="text-lg text-primary-600">
                {spot.expPerHour == null ? 'N/A' : Math.round(spot.expPerHour).toLocaleString()}
              </strong>
              <p className="text-xs text-gray-500">{copy.options.expHour}</p>
            </div>
            <div className="text-right">
              <strong>{spot.averageExp == null ? 'N/A' : Math.round(spot.averageExp).toLocaleString()}</strong>
              <p className="text-xs text-gray-500">{messages.averageExp}</p>
            </div>
            </>}
            {showPointsPerHour && <div className="text-right"><strong className="text-lg text-primary-600">{spot.pointsPerHour === null ? 'N/A' : spot.pointsPerHour.toFixed(3)}</strong><p className="text-xs text-gray-500">{copy.options.pointsHour}</p></div>}
            {showAverageShiny && <div className="text-right"><strong>{spot.averagePoints.toFixed(2)}</strong><p className="text-xs text-gray-500">{messages.averageShiny}</p></div>}
          </div>
        )}
        {context === 'shinyWar' && onQueue && (
          <div className="ml-auto flex items-center justify-end gap-2">
            <button className="btn btn-secondary whitespace-nowrap px-4 py-2 text-sm" onClick={() => onQueue(spot, false, targetSpecies, title)}>{messages.queue}</button>
            <button className="btn btn-primary whitespace-nowrap px-4 py-2 text-sm" onClick={() => onQueue(spot, true, targetSpecies, title)}>{messages.huntNow}</button>
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 border-t border-gray-100 pt-3 dark:border-gray-800 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {spot.composition.map((species) => (
          <div key={`${species.slug}-${species.form}`} className="flex min-w-0 items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
            <SpeciesSprite form={species.form} name={species.name} slug={species.slug} />
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center">
                <span className="font-bold">{game.species(species.name)}</span>
                <span className="ml-1">
                  · {species.rate_unknown
                    ? <span aria-label="Unknown encounter rate">???</span>
                    : species.is_special
                      ? <span className="font-semibold text-sky-600 dark:text-sky-400">{messages.special}</span>
                      : `${(species.split * 100).toFixed(2)}%`}
                  {species.is_lure && <span className="font-semibold text-amber-600 dark:text-amber-400"> · {messages.lureOnly}</span>}
                  {!species.rate_unknown && !species.is_special && showTier && <> · {game.tier(species.tier)}</>}
                </span>
              </div>
              {(showLevel || showEvYield || showEggGroups) && (
                <div>
                  {showLevel && <span>{game.level} {species.min_level}{species.max_level !== species.min_level && `–${species.max_level}`}</span>}
                  {showEvYield && evLabels(species) && <span className={`${showLevel ? 'ml-1' : ''} text-emerald-700 dark:text-emerald-300`}>{showLevel && '· '}{evLabels(species)} EV</span>}
                  {showEggGroups && Boolean(species.egg_groups?.length) && <span className={`${showLevel || (showEvYield && evLabels(species)) ? 'ml-1' : ''} text-violet-700 dark:text-violet-300`}>{(showLevel || (showEvYield && evLabels(species))) && '· '}{(species.egg_groups || []).map(game.eggGroup).join(', ')}</span>}
                </div>
              )}
            </div>
          </div>
        ))}
        {(showEncountersPerHour || showEffectiveOdds) && (
          <p className="text-xs text-gray-500 sm:col-span-2 lg:col-span-3 2xl:col-span-4">
            {spot.encountersPerHour === null
              ? messages.noHourly
              : <>{showEncountersPerHour && `${spot.encountersPerHour.toLocaleString()} ${messages.encountersHour}`}{showEncountersPerHour && showEffectiveOdds && ' · '}{showEffectiveOdds && `1/${spot.denominator.toLocaleString()} ${messages.effectiveOdds}`}</>}
          </p>
        )}
      </div>
      {context === 'shinyWar' && <LocationQueueStatus participants={participants} spot={spot} />}
    </article>
  );
}
