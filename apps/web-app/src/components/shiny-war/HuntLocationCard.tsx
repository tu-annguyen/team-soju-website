import { useState } from 'react';
import HuntSpotCard from './HuntSpotCard';
import type { HuntSpecies, HuntSpot, ParticipantHunts } from './types';
import type { HuntFinderContext, HuntSort, SortDirection } from '../hunt-finder/types';
import { getHuntFinderMessages } from '../hunt-finder/messages';
import { getGameTranslations } from '../../utils/gameTranslations';

type Props = {
  participants: ParticipantHunts[];
  locale?: string;
  context?: HuntFinderContext;
  spots: HuntSpot[];
  targetSpecies?: HuntSpecies;
  locationOpen: boolean;
  onQueue?: (spot: HuntSpot, current: boolean, targetSpecies?: HuntSpecies, title?: string) => void;
  onToggleLocation: () => void;
  sort?: HuntSort;
  sortDirection?: SortDirection;
};

const SINGLE_METHODS = new Set(['Grass', 'Cave', 'Water', 'Inside', 'Dark Grass', 'Dust Cloud', 'Shadow']);
const SWEET_SCENT_TERRAINS = new Set(['Grass', 'Dark Grass', 'Water', 'Cave', 'Inside']);

function encounterType(spot: HuntSpot, translate: (value: string) => string) {
  if (spot.horde_size) {
    return SWEET_SCENT_TERRAINS.has(spot.method)
      ? `${translate('Sweet Scent')} ${translate(spot.method)}`
      : translate('Sweet Scent');
  }
  if (SINGLE_METHODS.has(spot.method)) return `${translate('Singles')} ${translate(spot.method)}`;
  return translate(spot.method);
}

function splitTitles(
  spots: HuntSpot[],
  translate: (value: string) => string,
  translateLocation: (value: string) => string,
  splitLabel: string
) {
  const totals = new Map<string, number>();
  spots.forEach((spot) => {
    const type = encounterType(spot, translate);
    totals.set(type, (totals.get(type) || 0) + 1);
  });
  const occurrences = new Map<string, number>();
  return spots.map((spot) => {
    const type = encounterType(spot, translate);
    const occurrence = (occurrences.get(type) || 0) + 1;
    occurrences.set(type, occurrence);
    const needsSplitNumber = (totals.get(type) || 0) > 1;
    const label = needsSplitNumber ? `${type} ${splitLabel} ${occurrence}` : type;
    const areas = spot.location_areas?.filter(Boolean) || [];
    return areas.length ? `${areas.map(translateLocation).join(', ')} · ${label}` : label;
  });
}

export default function HuntLocationCard({
  locationOpen, participants, locale, spots, targetSpecies, onQueue, onToggleLocation,
  context = 'shinyWar', sort = 'pointsPerHour', sortDirection = 'desc',
}: Props) {
  const [lowerRateOpen, setLowerRateOpen] = useState(false);
  const messages = getHuntFinderMessages(locale).results;
  const game = getGameTranslations(locale);
  const titles = splitTitles(spots, game.label, game.location, messages.split);
  const titledSpots = spots.map((spot, index) => ({ spot, title: titles[index] }));
  const direction = sortDirection === 'asc' ? 1 : -1;
  const metric = sort === 'expPerHour' ? 'expPerHour' : 'pointsPerHour';
  const rankedSpots = sort === 'alphabetical' ? titledSpots : [...titledSpots].sort((left, right) => {
    const leftValue = left.spot[metric];
    const rightValue = right.spot[metric];
    if (leftValue == null) return rightValue == null ? 0 : 1;
    if (rightValue == null) return -1;
    return direction * (leftValue - rightValue);
  });
  const firstRanked = rankedSpots[0];
  const bestSpots = sort === 'alphabetical'
    ? rankedSpots
    : rankedSpots.filter(({ spot }) => spot[metric] === firstRanked?.spot[metric]);
  const lowerRateSpots = rankedSpots.filter((entry) => !bestSpots.includes(entry));
  const firstSpot = bestSpots[0]?.spot || spots[0];
  const secondaryLabel = sort === 'pointsPerHour' && sortDirection === 'desc'
    ? messages.lowerPoints
    : sort === 'expPerHour' ? messages.lowerExp : messages.lowerPoints;

  const renderSpot = ({ spot, title }: typeof titledSpots[number]) => (
    <HuntSpotCard
      key={spot.spot_key}
      participants={participants}
      locale={locale}
      context={context}
      spot={spot}
      sort={sort}
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
          <span className="block text-lg font-bold leading-tight text-gray-950 dark:text-white">{game.location(firstSpot.location)}</span>
          <span className="mt-0.5 block text-xs font-semibold text-primary-600 dark:text-primary-300">
            {game.region(firstSpot.region)} · {spots.length} {messages.encounter} {spots.length === 1 ? messages.split : messages.splits}
          </span>
        </button>
        <button
          aria-expanded={locationOpen}
          aria-label={`${locationOpen ? messages.collapse : messages.expand} ${game.location(firstSpot.location)}`}
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
                  {lowerRateOpen ? messages.hide : messages.show} {lowerRateSpots.length} {secondaryLabel} {lowerRateSpots.length === 1 ? messages.split : messages.splits}
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
