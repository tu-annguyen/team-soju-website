import { useEffect, useState } from 'react';
import { CATCH_EVENT_REGIONS } from '../../utils/catchEventLocations';
import { POKEMON_SPECIES_NAMES } from '../../utils/pokemonSpecies';
import { FilteredCombobox } from '../catch-events/FilteredCombobox';
import { shinyWarRequest } from './api';
import HuntResults from './HuntResults';
import type { HuntView } from './HuntResults';
import type { HuntSpecies, HuntSpot, ParticipantHunts } from './types';

type Props = {
  apiBaseUrl: string;
  defaultSeason: string;
  participants: ParticipantHunts[];
  onQueue: (spot: HuntSpot, current: boolean, targetSpecies?: HuntSpecies) => void;
};

const fieldClasses =
  'mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-white';
const labelClasses = 'text-sm font-semibold text-gray-800 dark:text-gray-100';
const checkboxClasses =
  'h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-500/30 dark:border-gray-600 dark:bg-gray-950';
const encounterMethods = [
  ['All', 'Every wild encounter method'],
  ['Sweet Scent', 'Sweet Scent (Hordes)'],
  ['Singles', 'Singles'],
  ['Fishing', 'Fishing'],
  ['Honey Trees', 'Honey Trees'],
  ['Headbutt', 'Headbutt'],
  ['Rock Smash', 'Rock Smash'],
] as const;

export default function HuntFinder({ apiBaseUrl, defaultSeason, participants, onQueue }: Props) {
  const [filters, setFilters] = useState({
    season: defaultSeason || 'Summer', region: '', location: '', species: '', tier: '', time: '', method: 'All',
    hordeSize: '', hordesPerHour: '240', eventBoost: true, donator: false,
    fullSplitOnly: false, minPointsPerHour: '', personalCharm: false, linkCharm: false,
    chumBucket: false, sort: 'pointsPerHour',
  });
  const [spots, setSpots] = useState<HuntSpot[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState<HuntView>('location');
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        setError('');
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (filters.method !== 'Sweet Scent' && ['hordeSize', 'hordesPerHour', 'fullSplitOnly'].includes(key)) return;
          if (['Headbutt', 'Rock Smash'].includes(filters.method) && key === 'minPointsPerHour') return;
          if (filters.method !== 'Fishing' && key === 'chumBucket') return;
          if (value !== '') params.set(key, String(value));
        });
        params.set('pageSize', '1000');
        const data = await shinyWarRequest<{ items: HuntSpot[]; total: number; locations: string[] }>(
          apiBaseUrl, `/hordes?${params}`
        );
        setSpots(data.items);
        setTotal(data.total);
        setLocations(data.locations || []);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Could not load hunts.');
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [apiBaseUrl, filters]);

  const update = (key: string, value: string | boolean) => setFilters((current) => ({ ...current, [key]: value }));
  const isSweetScent = filters.method === 'Sweet Scent';
  const isFishing = filters.method === 'Fishing';
  const hasHourlyData = !['Headbutt', 'Rock Smash'].includes(filters.method);
  const visibleSpotKeys = [...new Set(spots.map((spot) => spot.spot_key))];
  const allLocationsExpanded = visibleSpotKeys.length > 0
    && visibleSpotKeys.every((spotKey) => expanded.has(spotKey));

  const toggleSpot = (spotKey: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(spotKey)) next.delete(spotKey);
      else next.add(spotKey);
      return next;
    });
  };

  const toggleAllSpots = () => {
    setExpanded(allLocationsExpanded ? new Set() : new Set(visibleSpotKeys));
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-gray-700 dark:bg-gray-900">
        <label className={labelClasses}>
          Season
          <select value={filters.season} onChange={(e) => update('season', e.target.value)} className={fieldClasses}>
            <option value="">Any season</option>
            {['Summer', 'Autumn', 'Winter', 'Spring'].map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className={labelClasses}>
          Region
          <FilteredCombobox
            className={fieldClasses}
            options={CATCH_EVENT_REGIONS}
            value={filters.region}
            onChange={(region) => setFilters((current) => ({ ...current, region, location: '' }))}
            placeholder="Every region"
          />
        </label>
        <label className={labelClasses}>
          Location
          <FilteredCombobox
            className={fieldClasses}
            options={locations}
            value={filters.location}
            onChange={(location) => update('location', location)}
            placeholder="Every location"
          />
        </label>
        <label className={labelClasses}>
          Species
          <FilteredCombobox
            className={fieldClasses}
            options={POKEMON_SPECIES_NAMES}
            value={filters.species}
            onChange={(species) => update('species', species)}
            placeholder="Every species"
          />
        </label>
        <label className={labelClasses}>
          Encounter method
          <select value={filters.method} onChange={(e) => update('method', e.target.value)} className={fieldClasses}>
            {encounterMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className={labelClasses}>
          Tier
          <select value={filters.tier} onChange={(e) => update('tier', e.target.value)} className={fieldClasses}>
            <option value="">Every tier</option>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((tier) => <option key={tier}>Tier {tier}</option>)}
          </select>
        </label>
        <label className={labelClasses}>
          Time
          <select value={filters.time} onChange={(e) => update('time', e.target.value)} className={fieldClasses}>
            <option value="">Any time</option>
            <option value="morning">Morning</option>
            <option value="day">Day</option>
            <option value="night">Night</option>
          </select>
        </label>
        <label className={labelClasses}>
          Minimum points/hour
          <input disabled={!hasHourlyData} type="number" min="0" step="0.001" value={filters.minPointsPerHour} onChange={(e) => update('minPointsPerHour', e.target.value)} placeholder={hasHourlyData ? 'No minimum' : 'Hourly data unavailable'} className={`${fieldClasses} disabled:cursor-not-allowed disabled:opacity-50`} />
        </label>
        <label className={labelClasses}>
          Horde size
          <select disabled={!isSweetScent} value={filters.hordeSize} onChange={(e) => update('hordeSize', e.target.value)} className={`${fieldClasses} disabled:cursor-not-allowed disabled:opacity-50`}>
            <option value="">3× and 5×</option><option value="3">3× only</option><option value="5">5× only</option>
          </select>
        </label>
        <label className={labelClasses}>
          Hordes/hour
          <input disabled={!isSweetScent} type="number" min="1" max="1000" value={filters.hordesPerHour} onChange={(e) => update('hordesPerHour', e.target.value)} className={`${fieldClasses} disabled:cursor-not-allowed disabled:opacity-50`} />
        </label>
        <label className={`flex items-center gap-2 self-end rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 ${!isSweetScent ? 'cursor-not-allowed opacity-50' : ''}`}>
          <input disabled={!isSweetScent} className={checkboxClasses} type="checkbox" checked={filters.fullSplitOnly} onChange={(e) => update('fullSplitOnly', e.target.checked)} />
          100% split hordes only
        </label>
        <fieldset className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:col-span-2 lg:col-span-4 dark:border-gray-700 dark:bg-gray-950">
          <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-gray-100">Boosts and charms</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['eventBoost', 'Event +10%'], ['donator', 'Donator +10%'],
              ['personalCharm', 'Personal charm'], ['linkCharm', 'Link charm'],
              ['chumBucket', 'Chum bucket'],
            ].map(([key, label]) => (
              <label key={key} className={`flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 ${key === 'chumBucket' && !isFishing ? 'cursor-not-allowed opacity-50' : ''}`}>
                <input disabled={key === 'chumBucket' && !isFishing} className={checkboxClasses} type="checkbox" checked={Boolean(filters[key as keyof typeof filters])} onChange={(e) => update(key, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" aria-label="Group hunt results by" role="group">
          {([['location', 'Location'], ['pokemon', 'Pokémon']] as const).map(([value, label]) => (
            <button
              aria-pressed={view === value}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                view === value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
              key={value}
              onClick={() => {
                setView(value);
                setExpanded(new Set());
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          disabled={visibleSpotKeys.length === 0}
          onClick={toggleAllSpots}
          type="button"
        >
          <span aria-hidden="true">{allLocationsExpanded ? '-' : '+'}</span>{' '}
          {allLocationsExpanded ? 'Collapse all' : 'Open all'}
        </button>
      </div>
      <p className="text-sm text-gray-500">
        {total} matching encounter groups. Rates are normalized within each location/time group.
      </p>
      {error && <p role="alert" className="text-rose-600">{error}</p>}
      <HuntResults
        expanded={expanded}
        participants={participants}
        speciesFilter={filters.species}
        spots={spots}
        view={view}
        onQueue={onQueue}
        onToggle={toggleSpot}
        selectedSeason={filters.season}
        selectedTime={filters.time}
        onSeasonChange={(season) => update('season', season)}
        onTimeChange={(time) => update('time', time)}
      />
    </div>
  );
}
