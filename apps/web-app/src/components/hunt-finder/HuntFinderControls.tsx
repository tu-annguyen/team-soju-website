import type { Dispatch, SetStateAction } from 'react';
import { CATCH_EVENT_REGIONS } from '../../utils/catchEventLocations';
import { POKEMON_SPECIES_NAMES } from '../../utils/pokemonSpecies';
import NumberSpinner from '../NumberSpinner';
import { FilteredCombobox } from '../catch-events/FilteredCombobox';
import { EV_STAT_OPTIONS, type EvAmount, type EvStat, type HuntFinderContext, type HuntFinderFilters } from './types';

type Props = {
  context: HuntFinderContext;
  filters: HuntFinderFilters;
  locations: string[];
  setFilters: Dispatch<SetStateAction<HuntFinderFilters>>;
  teamWarAvailable: boolean;
};

const fieldClasses = 'mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-white';
const labelClasses = 'text-sm font-semibold text-gray-800 dark:text-gray-100';
const checkboxClasses = 'h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-500/30 dark:border-gray-600 dark:bg-gray-950';
const encounterMethods = [
  ['All', 'Every wild encounter method'],
  ['Sweet Scent', 'Sweet Scent (Hordes)'],
  ['Singles', 'Singles'],
  ['Fishing', 'Fishing'],
  ['Honey Trees', 'Honey Trees'],
  ['Headbutt', 'Headbutt'],
  ['Rock Smash', 'Rock Smash'],
] as const;

export default function HuntFinderControls({
  context, filters, locations, setFilters, teamWarAvailable,
}: Props) {
  const update = <Key extends keyof HuntFinderFilters>(key: Key, value: HuntFinderFilters[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const toggleListValue = <Value extends string>(key: 'evStats' | 'evAmounts', value: Value) => {
    setFilters((current) => {
      const values = current[key] as string[];
      return { ...current, [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] };
    });
  };
  const supportsSweetScentFilters = ['All', 'Sweet Scent'].includes(filters.method);
  const supportsFishingFilters = ['All', 'Fishing'].includes(filters.method);
  const supportsNonSafari = ['All', 'Singles', 'Fishing'].includes(filters.method);
  const hasHourlyData = !['Headbutt', 'Rock Smash'].includes(filters.method);
  const isWar = context === 'shinyWar';

  return (
    <div className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-gray-700 dark:bg-gray-900">
      <label className={labelClasses}>
        Season
        <select value={filters.season} onChange={(event) => update('season', event.target.value)} className={fieldClasses}>
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
        <FilteredCombobox className={fieldClasses} options={locations} value={filters.location} onChange={(value) => update('location', value)} placeholder="Every location" />
      </label>
      <label className={labelClasses}>
        Species
        <FilteredCombobox className={fieldClasses} options={POKEMON_SPECIES_NAMES} value={filters.species} onChange={(value) => update('species', value)} placeholder="Every species" />
      </label>
      <label className={labelClasses}>
        Encounter method
        <select
          value={filters.method}
          onChange={(event) => setFilters((current) => ({
            ...current,
            method: event.target.value,
            sort: current.sort === 'expPerHour' && event.target.value !== 'Sweet Scent' ? 'pointsPerHour' : current.sort,
          }))}
          className={fieldClasses}
        >
          {encounterMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className={labelClasses}>
        Sort by
        <select value={filters.sort} onChange={(event) => update('sort', event.target.value as HuntFinderFilters['sort'])} className={fieldClasses}>
          <option value="pointsPerHour">Points/hour</option>
          <option value="expPerHour" disabled={filters.method !== 'Sweet Scent'}>EXP/hour</option>
          <option value="alphabetical">Alphabetical</option>
        </select>
      </label>
      <label className={labelClasses}>
        Sort direction
        <select value={filters.sortDirection} onChange={(event) => update('sortDirection', event.target.value as HuntFinderFilters['sortDirection'])} className={fieldClasses}>
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </label>
      <label className={labelClasses}>
        Time
        <select value={filters.time} onChange={(event) => update('time', event.target.value)} className={fieldClasses}>
          <option value="">Any time</option><option value="morning">Morning</option><option value="day">Day</option><option value="night">Night</option>
        </select>
      </label>
      <div className={labelClasses}>
        <span>Minimum Tier</span>
        <NumberSpinner aria-label="Minimum Tier" className={`${fieldClasses} !mt-0`} clearOnDecrementAtMax decrementLabel="Decrease minimum tier" incrementLabel="Increase minimum tier" max={7} min={0} onValueChange={(value) => update('minTier', value)} placeholder="No minimum" reverse step={1} value={filters.minTier} wrapperClassName="mt-2" />
      </div>
      <div className={labelClasses}>
        <span>Minimum level</span>
        <NumberSpinner aria-label="Minimum level" className={`${fieldClasses} !mt-0`} min={1} max={100} onValueChange={(value) => update('minLevel', value)} placeholder="No minimum" step={1} value={filters.minLevel} wrapperClassName="mt-2" />
      </div>
      {filters.sort === 'pointsPerHour' && (
        <div className={labelClasses}>
          <span>Minimum points/hour</span>
          <NumberSpinner aria-label="Minimum points/hour" className={`${fieldClasses} !mt-0 disabled:cursor-not-allowed disabled:opacity-50`} disabled={!hasHourlyData} min={0} onValueChange={(value) => update('minPointsPerHour', value)} placeholder={hasHourlyData ? 'No minimum' : 'Hourly data unavailable'} step={0.001} value={filters.minPointsPerHour} wrapperClassName="mt-2" />
        </div>
      )}
      <label className={labelClasses}>
        Horde size
        <select disabled={!supportsSweetScentFilters} value={filters.hordeSize} onChange={(event) => update('hordeSize', event.target.value)} className={`${fieldClasses} disabled:cursor-not-allowed disabled:opacity-50`}>
          <option value="">3× and 5×</option><option value="3">3× only</option><option value="5">5× only</option>
        </select>
      </label>
      <div className={labelClasses}>
        <span>Hordes/hour</span>
        <NumberSpinner aria-label="Hordes/hour" className={`${fieldClasses} !mt-0 disabled:cursor-not-allowed disabled:opacity-50`} disabled={!supportsSweetScentFilters} max={1000} min={1} onValueChange={(value) => update('hordesPerHour', value)} value={filters.hordesPerHour} wrapperClassName="mt-2" />
      </div>
      <label className={`flex items-center gap-2 self-end rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 ${!supportsSweetScentFilters ? 'cursor-not-allowed opacity-50' : ''}`}>
        <input disabled={!supportsSweetScentFilters} className={checkboxClasses} type="checkbox" checked={filters.fullSplitOnly} onChange={(event) => update('fullSplitOnly', event.target.checked)} />
        100% split hordes only
      </label>
      <label className={`flex items-center gap-2 self-end rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 ${!supportsNonSafari ? 'cursor-not-allowed opacity-50' : ''}`}>
        <input disabled={!supportsNonSafari} className={checkboxClasses} type="checkbox" checked={filters.nonSafari} onChange={(event) => update('nonSafari', event.target.checked)} />
        Non-Safari only
      </label>

      <fieldset className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:col-span-2 lg:col-span-4 dark:border-gray-700 dark:bg-gray-950">
        <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-gray-100">EV yield</legend>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EV_STAT_OPTIONS.map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <input className={checkboxClasses} type="checkbox" checked={filters.evStats.includes(value)} onChange={() => toggleListValue<EvStat>('evStats', value)} />{label}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 lg:border-l lg:border-gray-200 lg:pl-4 dark:lg:border-gray-700">
            {(['1', '2'] as EvAmount[]).map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <input className={checkboxClasses} type="checkbox" checked={filters.evAmounts.includes(value)} onChange={() => toggleListValue<EvAmount>('evAmounts', value)} />+{value} EV
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      {isWar && <WarOnlyControls filters={filters} setFilters={setFilters} teamWarAvailable={teamWarAvailable} />}

      {filters.sort === 'pointsPerHour' && (
        <fieldset className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:col-span-2 lg:col-span-4 dark:border-gray-700 dark:bg-gray-950">
          <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-gray-100">Boosts and charms</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {([['eventBoost', 'Event +10%'], ['donator', 'Donator +10%'], ['personalCharm', 'Personal charm'], ['linkCharm', 'Link charm'], ['chumBucket', 'Chum bucket']] as const).map(([key, label]) => (
              <label key={key} className={`flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 ${key === 'chumBucket' && !supportsFishingFilters ? 'cursor-not-allowed opacity-50' : ''}`}>
                <input disabled={key === 'chumBucket' && !supportsFishingFilters} className={checkboxClasses} type="checkbox" checked={filters[key]} onChange={(event) => update(key, event.target.checked)} />{label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {filters.sort === 'expPerHour' && (
        <fieldset className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:col-span-2 lg:col-span-4 dark:border-gray-700 dark:bg-gray-950">
          <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-gray-100">Charms</legend>
          <div className="flex flex-wrap gap-4">
            {([['', 'No EXP Charm'], ['0.25', 'EXP Charm +25%'], ['0.5', 'EXP Charm +50%'], ['1', 'EXP Charm +100%']] as const).map(([value, label]) => (
              <label key={value || 'none'} className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <input className={checkboxClasses} type="radio" name="exp-charm" checked={filters.expCharm === value} onChange={() => update('expCharm', value)} />{label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

function WarOnlyControls({ filters, setFilters, teamWarAvailable }: Pick<Props, 'filters' | 'setFilters' | 'teamWarAvailable'>) {
  return (
    <>
      <fieldset className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:col-span-2 dark:border-gray-700 dark:bg-gray-950">
        <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-gray-100">Exclude caught evolution lines</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <input aria-label="Exclude Official caught evolution lines" className={checkboxClasses} type="checkbox" checked={filters.excludeOfficialCaught} onChange={(event) => setFilters((current) => ({ ...current, excludeOfficialCaught: event.target.checked, excludeTeamCaught: event.target.checked ? false : current.excludeTeamCaught }))} />From Official War participants
          </label>
          <label className={`flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 ${!teamWarAvailable ? 'cursor-not-allowed opacity-50' : ''}`}>
            <input aria-label="Exclude Team War caught evolution lines" className={checkboxClasses} type="checkbox" disabled={!teamWarAvailable} checked={filters.excludeTeamCaught} onChange={(event) => setFilters((current) => ({ ...current, excludeOfficialCaught: event.target.checked ? false : current.excludeOfficialCaught, excludeTeamCaught: event.target.checked }))} />From Team War participants
          </label>
        </div>
      </fieldset>
      <fieldset className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:col-span-2 dark:border-gray-700 dark:bg-gray-950">
        <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-gray-100">Include unique species bonus in calculations</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <input aria-label="Official unique species +8" className={checkboxClasses} type="checkbox" checked={filters.officialUniqueBonus} onChange={(event) => setFilters((current) => ({ ...current, officialUniqueBonus: event.target.checked, teamUniqueBonus: event.target.checked ? false : current.teamUniqueBonus }))} />From Official War participants
          </label>
          <label className={`flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 ${!teamWarAvailable ? 'cursor-not-allowed opacity-50' : ''}`}>
            <input aria-label="Team War unique species +8" className={checkboxClasses} type="checkbox" disabled={!teamWarAvailable} checked={filters.teamUniqueBonus} onChange={(event) => setFilters((current) => ({ ...current, officialUniqueBonus: event.target.checked ? false : current.officialUniqueBonus, teamUniqueBonus: event.target.checked }))} />From Team War participants
          </label>
        </div>
      </fieldset>
    </>
  );
}
