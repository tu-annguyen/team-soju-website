import { useEffect, useState } from 'react';
import { CATCH_EVENT_REGIONS } from '../../utils/catchEventLocations';
import { POKEMON_SPECIES_NAMES } from '../../utils/pokemonSpecies';
import { FilteredCombobox } from '../catch-events/FilteredCombobox';
import { shinyWarRequest } from './api';
import SpeciesSpriteName from './SpeciesSpriteName';
import type { HordeSpot } from './types';

type Props = {
  apiBaseUrl: string;
  defaultSeason: string;
  onQueue: (spot: HordeSpot, current: boolean) => void;
};

const fieldClasses =
  'mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-white';
const labelClasses = 'text-sm font-semibold text-gray-800 dark:text-gray-100';
const checkboxClasses =
  'h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-500/30 dark:border-gray-600 dark:bg-gray-950';

export default function HordeFinder({ apiBaseUrl, defaultSeason, onQueue }: Props) {
  const [filters, setFilters] = useState({
    season: defaultSeason || 'Summer', region: '', species: '', tier: '', time: '',
    hordeSize: '', hordesPerHour: '240', eventBoost: true, donator: false,
    personalCharm: false, linkCharm: false, sort: 'pointsPerHour',
  });
  const [spots, setSpots] = useState<HordeSpot[]>([]);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        setError('');
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== '') params.set(key, String(value));
        });
        params.set('pageSize', '50');
        const data = await shinyWarRequest<{ items: HordeSpot[]; total: number }>(
          apiBaseUrl, `/hordes?${params}`
        );
        setSpots(data.items);
        setTotal(data.total);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Could not load hordes.');
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [apiBaseUrl, filters]);

  const update = (key: string, value: string | boolean) => setFilters((current) => ({ ...current, [key]: value }));
  return (
    <div className="space-y-5">
      <div className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-gray-700 dark:bg-gray-900">
        <label className={labelClasses}>
          Season
          <select value={filters.season} onChange={(e) => update('season', e.target.value)} className={fieldClasses}>
            <option value="">Every season</option>
            {['Summer', 'Autumn', 'Winter', 'Spring'].map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className={labelClasses}>
          Region
          <FilteredCombobox
            className={fieldClasses}
            options={CATCH_EVENT_REGIONS}
            value={filters.region}
            onChange={(region) => update('region', region)}
            placeholder="Every region"
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
          Tier
          <select value={filters.tier} onChange={(e) => update('tier', e.target.value)} className={fieldClasses}>
            <option value="">Every tier</option>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((tier) => <option key={tier}>Tier {tier}</option>)}
          </select>
        </label>
        <label className={labelClasses}>
          Time
          <select value={filters.time} onChange={(e) => update('time', e.target.value)} className={fieldClasses}>
            <option value="">Every time</option>
            <option value="morning">Morning</option>
            <option value="day">Day</option>
            <option value="night">Night</option>
          </select>
        </label>
        <label className={labelClasses}>
          Horde size
          <select value={filters.hordeSize} onChange={(e) => update('hordeSize', e.target.value)} className={fieldClasses}>
            <option value="">3× and 5×</option><option value="3">3× only</option><option value="5">5× only</option>
          </select>
        </label>
        <label className={labelClasses}>
          Hordes/hour
          <input type="number" min="1" max="1000" value={filters.hordesPerHour} onChange={(e) => update('hordesPerHour', e.target.value)} className={fieldClasses} />
        </label>
        <fieldset className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:col-span-2 lg:col-span-4 dark:border-gray-700 dark:bg-gray-950">
          <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-gray-100">Boosts and charms</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['eventBoost', 'Event +10%'], ['donator', 'Donator +10%'],
              ['personalCharm', 'Personal charm'], ['linkCharm', 'Link charm'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <input className={checkboxClasses} type="checkbox" checked={Boolean(filters[key as keyof typeof filters])} onChange={(e) => update(key, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <p className="text-sm text-gray-500">{total} matching horde groups. Rates are normalized within each location/time group.</p>
      {error && <p role="alert" className="text-rose-600">{error}</p>}
      <div className="space-y-3">
        {spots.map((spot) => (
          <article key={spot.spot_key} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-wrap items-start gap-4">
              <button className="min-w-0 flex-1 text-left" onClick={() => setExpanded(expanded === spot.spot_key ? '' : spot.spot_key)}>
                <h3 className="font-bold text-gray-950 dark:text-white">{spot.location}</h3>
                <p className="text-sm text-gray-500">{spot.region} · {spot.season} {spot.time} · {spot.horde_size}× {spot.method}</p>
              </button>
              <div className="text-right"><strong className="text-xl text-primary-600">{spot.pointsPerHour.toFixed(3)}</strong><p className="text-xs text-gray-500">points/hour</p></div>
              <div className="text-right"><strong>{spot.averagePoints.toFixed(2)}</strong><p className="text-xs text-gray-500">average/shiny</p></div>
              <button className="btn btn-secondary text-sm" onClick={() => onQueue(spot, false)}>Queue</button>
              <button className="btn btn-primary text-sm" onClick={() => onQueue(spot, true)}>Hunt now</button>
            </div>
            {expanded === spot.spot_key && (
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
                  </p>
                ))}
                <p className="text-xs text-gray-500 sm:col-span-2">
                  {spot.encountersPerHour.toLocaleString()} encounters/hour · 1/{spot.denominator.toLocaleString()} effective odds
                </p>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
