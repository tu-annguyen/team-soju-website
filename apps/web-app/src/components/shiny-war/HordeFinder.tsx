import { useEffect, useState } from 'react';
import { shinyWarRequest } from './api';
import type { HordeSpot } from './types';

type Props = {
  apiBaseUrl: string;
  defaultSeason: string;
  onQueue: (spot: HordeSpot, current: boolean) => void;
};

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
      <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-gray-700 dark:bg-gray-900">
        <select value={filters.season} onChange={(e) => update('season', e.target.value)} className="rounded-lg border-gray-300 dark:bg-gray-800">
          <option value="">Every season</option>
          {['Summer', 'Autumn', 'Winter', 'Spring'].map((value) => <option key={value}>{value}</option>)}
        </select>
        <input value={filters.region} onChange={(e) => update('region', e.target.value)} placeholder="Region" className="rounded-lg border-gray-300 dark:bg-gray-800" />
        <input value={filters.species} onChange={(e) => update('species', e.target.value)} placeholder="Species" className="rounded-lg border-gray-300 dark:bg-gray-800" />
        <select value={filters.tier} onChange={(e) => update('tier', e.target.value)} className="rounded-lg border-gray-300 dark:bg-gray-800">
          <option value="">Every tier</option>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((tier) => <option key={tier}>Tier {tier}</option>)}
        </select>
        <select value={filters.time} onChange={(e) => update('time', e.target.value)} className="rounded-lg border-gray-300 dark:bg-gray-800">
          <option value="">Every time</option><option>morning</option><option>day</option><option>night</option>
        </select>
        <select value={filters.hordeSize} onChange={(e) => update('hordeSize', e.target.value)} className="rounded-lg border-gray-300 dark:bg-gray-800">
          <option value="">3× and 5×</option><option value="3">3× only</option><option value="5">5× only</option>
        </select>
        <label className="text-sm text-gray-600 dark:text-gray-300">Hordes/hour
          <input type="number" min="1" max="1000" value={filters.hordesPerHour} onChange={(e) => update('hordesPerHour', e.target.value)} className="mt-1 w-full rounded-lg border-gray-300 dark:bg-gray-800" />
        </label>
        {[
          ['eventBoost', 'Event +10%'], ['donator', 'Donator +10%'],
          ['personalCharm', 'Personal charm'], ['linkCharm', 'Link charm'],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={Boolean(filters[key as keyof typeof filters])} onChange={(e) => update(key, e.target.checked)} /> {label}
          </label>
        ))}
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
                  <p key={`${species.slug}-${species.form}`} className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>{species.name}</strong> · {(species.split * 100).toFixed(2)}% · {species.tier} · Lv. {species.min_level}–{species.max_level}
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

