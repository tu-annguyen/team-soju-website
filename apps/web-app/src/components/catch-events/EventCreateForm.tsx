import React from 'react';
import type { FormEvent } from 'react';
import { POKEMON_NATURES } from '../../utils/catchEventScoring';
import { POKEMON_SPECIES_NAMES } from '../../utils/pokemonSpecies';
import {
  CATCH_EVENT_REGIONS,
  CATCH_EVENT_ROUTES_BY_REGION,
  type CatchEventRegion,
} from '../../utils/catchEventLocations';
import type { AuthUser, EventForm, HostTab, RuleRow } from './shared';
import {
  fieldClasses,
  labelClasses,
  makeId,
  panelClasses,
  smallButtonClasses,
} from './shared';
import { CatchEventDateTimeInput } from './CatchEventDateTimeInput';

type Props = {
  editingEventId: string;
  isAuthLoading: boolean;
  authUser: AuthUser | null;
  eventForm: EventForm;
  speciesRows: RuleRow[];
  natureRows: RuleRow[];
  createError: string;
  tr: (text: string) => string;
  translateSpeciesDisplay: (species: string) => string;
  translateNatureDisplay: (nature: string) => string;
  translateRegion: (region: string) => string;
  translateLocation: (location: string) => string;
  setEventForm: (form: EventForm) => void;
  setSpeciesRows: React.Dispatch<React.SetStateAction<RuleRow[]>>;
  setNatureRows: React.Dispatch<React.SetStateAction<RuleRow[]>>;
  setEditingEventId: (eventId: string) => void;
  setCreateError: (error: string) => void;
  setHostTab: (tab: HostTab) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function RuleEditor({
  title,
  kind,
  rows,
  options,
  tr,
  translateSpeciesDisplay,
  translateNatureDisplay,
  setSpeciesRows,
  setNatureRows,
}: {
  title: string;
  kind: 'species' | 'nature';
  rows: RuleRow[];
  options: readonly string[];
  tr: (text: string) => string;
  translateSpeciesDisplay: (species: string) => string;
  translateNatureDisplay: (nature: string) => string;
  setSpeciesRows: React.Dispatch<React.SetStateAction<RuleRow[]>>;
  setNatureRows: React.Dispatch<React.SetStateAction<RuleRow[]>>;
}) {
  const updateRuleRow = (rowId: string, patch: Partial<RuleRow>) => {
    const updateRows = (currentRows: RuleRow[]) =>
      currentRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row));

    if (kind === 'species') {
      setSpeciesRows(updateRows);
      return;
    }

    setNatureRows(updateRows);
  };
  const removeRuleRow = (rowId: string) => {
    const updateRows = (currentRows: RuleRow[], prefix: string) => {
      const nextRows = currentRows.filter((row) => row.id !== rowId);
      return nextRows.length ? nextRows : [{ id: makeId(prefix), name: '', points: '0' }];
    };

    if (kind === 'species') {
      setSpeciesRows((currentRows) => updateRows(currentRows, 'species'));
      return;
    }

    setNatureRows((currentRows) => updateRows(currentRows, 'nature'));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-950 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {tr('Use positive points for bonuses, negative points for penalties, and 0 for neutral scoring.')}
          </p>
        </div>
        <button
          type="button"
          className={smallButtonClasses}
          onClick={() =>
            kind === 'species'
              ? setSpeciesRows((current) => [...current, { id: makeId('species'), name: '', points: '0' }])
              : setNatureRows((current) => [...current, { id: makeId('nature'), name: '', points: '0' }])
          }
        >
          {tr('Add')}
        </button>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
            <label className={labelClasses}>
              {kind === 'species' ? tr('Pokemon species') : tr('Nature')}
              <input
                className={fieldClasses}
                list={kind === 'species' ? 'pokemon-species-options' : 'nature-options'}
                value={row.name}
                onChange={(event) => updateRuleRow(row.id, { name: event.target.value })}
                required
              />
            </label>
            <label className={labelClasses}>
              {tr('Points')}
              <input
                className={fieldClasses}
                inputMode="numeric"
                pattern="-?[0-9]*"
                value={row.points}
                onChange={(event) => {
                  const nextValue = event.target.value;

                  if (/^-?\d*$/.test(nextValue)) {
                    updateRuleRow(row.id, { points: nextValue });
                  }
                }}
              />
            </label>
            <button
              type="button"
              className={`${smallButtonClasses} self-end`}
              onClick={() => removeRuleRow(row.id)}
            >
              {tr('Remove')}
            </button>
          </div>
        ))}
      </div>
      <datalist id={kind === 'species' ? 'pokemon-species-options' : 'nature-options'}>
        {options.map((option) => (
          <option
            key={option}
            value={option}
            label={kind === 'species' ? translateSpeciesDisplay(option) : translateNatureDisplay(option)}
          />
        ))}
      </datalist>
    </div>
  );
}

export function EventCreateForm({
  editingEventId,
  isAuthLoading,
  authUser,
  eventForm,
  speciesRows,
  natureRows,
  createError,
  tr,
  translateSpeciesDisplay,
  translateNatureDisplay,
  translateRegion,
  translateLocation,
  setEventForm,
  setSpeciesRows,
  setNatureRows,
  setEditingEventId,
  setCreateError,
  setHostTab,
  onSubmit,
}: Props) {
  return (
    <form className={`${panelClasses} space-y-6`} onSubmit={onSubmit}>
      <div>
        <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{editingEventId ? tr('Edit Event') : tr('Create Event')}</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {tr('Add each target Pokemon from the species list and give it a positive, negative, or zero point value.')}
        </p>
      </div>
      {!isAuthLoading && !authUser && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {tr('Sign in to create events and access owner-only management tools.')}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClasses}>
          {tr('Event name')}
          <input className={fieldClasses} value={eventForm.name} onChange={(event) => setEventForm({ ...eventForm, name: event.target.value })} required />
        </label>
        <label className={labelClasses}>
          {tr('Start time')}
          <CatchEventDateTimeInput value={eventForm.startLocal} onChange={(startLocal) => setEventForm({ ...eventForm, startLocal })} required ariaLabel={tr('Start time')} />
        </label>
        <label className={labelClasses}>
          {tr('End time')}
          <CatchEventDateTimeInput value={eventForm.endLocal} onChange={(endLocal) => setEventForm({ ...eventForm, endLocal })} required ariaLabel={tr('End time')} />
        </label>
        <label className={labelClasses}>
          {tr('Event timezone')}
          <input className={fieldClasses} list="timezone-options" value={eventForm.timezone} onChange={(event) => setEventForm({ ...eventForm, timezone: event.target.value })} required />
        </label>
        <label className={labelClasses}>
          {tr('Region')}
          <input
            className={fieldClasses}
            list="catch-event-region-options"
            value={eventForm.region}
            onChange={(event) => {
              const nextRegion = event.target.value;
              setEventForm({
                ...eventForm,
                region: nextRegion,
                route: CATCH_EVENT_REGIONS.includes(nextRegion as CatchEventRegion)
                  ? ''
                  : eventForm.route,
              });
            }}
            required
          />
          <datalist id="catch-event-region-options">
            {CATCH_EVENT_REGIONS.map((region) => (
              <option key={region} value={region} label={translateRegion(region)} />
            ))}
          </datalist>
        </label>
        <label className={labelClasses}>
          {tr('Route')}
          <input
            className={fieldClasses}
            list="catch-event-route-options"
            value={eventForm.route}
            onChange={(event) => setEventForm({ ...eventForm, route: event.target.value })}
            required
          />
          <datalist id="catch-event-route-options">
            {(CATCH_EVENT_ROUTES_BY_REGION[eventForm.region as CatchEventRegion] || []).map((route) => (
              <option key={route} value={route} label={translateLocation(route)} />
            ))}
          </datalist>
        </label>
        <label className={labelClasses}>
          {tr('Number of winners')}
          <input className={fieldClasses} min={1} max={10} type="number" value={eventForm.winnerCount} onChange={(event) => setEventForm({ ...eventForm, winnerCount: event.target.value })} required />
        </label>
      </div>
      <RuleEditor
        title={tr('Target Pokemon And Species Points')}
        kind="species"
        rows={speciesRows}
        options={POKEMON_SPECIES_NAMES}
        tr={tr}
        translateSpeciesDisplay={translateSpeciesDisplay}
        translateNatureDisplay={translateNatureDisplay}
        setSpeciesRows={setSpeciesRows}
        setNatureRows={setNatureRows}
      />
      <RuleEditor
        title={tr('Nature Points')}
        kind="nature"
        rows={natureRows}
        options={POKEMON_NATURES}
        tr={tr}
        translateSpeciesDisplay={translateSpeciesDisplay}
        translateNatureDisplay={translateNatureDisplay}
        setSpeciesRows={setSpeciesRows}
        setNatureRows={setNatureRows}
      />
      <label className="flex items-start gap-3 text-sm font-medium text-gray-800 dark:text-gray-100">
        <input className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600" type="checkbox" checked={eventForm.useLowestScoreFinalPlace} onChange={(event) => setEventForm({ ...eventForm, useLowestScoreFinalPlace: event.target.checked })} />
        {tr('Reserve the final winner slot for the lowest verified score.')}
      </label>
      <label className="flex items-start gap-3 text-sm font-medium text-gray-800 dark:text-gray-100">
        <input className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600" type="checkbox" checked={eventForm.isPrivate} onChange={(event) => setEventForm({ ...eventForm, isPrivate: event.target.checked })} />
        <span>
          <span className="block font-semibold">{tr('Private event')}</span>
          <span className="block text-sm font-normal text-gray-600 dark:text-gray-300">
            {tr('Private events require the event link and are hidden from event search.')}
          </span>
        </span>
      </label>
      {createError && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:bg-rose-950 dark:text-rose-100">
          {createError}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700">
          {editingEventId ? tr('Update event') : tr('Save event')}
        </button>
        {editingEventId && (
          <button
            type="button"
            className={smallButtonClasses}
            onClick={() => {
              setEditingEventId('');
              setCreateError('');
              setHostTab('manage');
            }}
          >
            {tr('Cancel edit')}
          </button>
        )}
      </div>
    </form>
  );
}
