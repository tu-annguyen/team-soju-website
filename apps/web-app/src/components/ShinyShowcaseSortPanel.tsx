import React from 'react';
import NumberSpinner from './NumberSpinner';

export interface ShowcaseSort {
  sortBy: 'number_ot' | 'points' | 'points_per_num_ot';
  sortOrder: 'asc' | 'desc';
  minNumOT: string;
}

interface ShinyShowcaseSortPanelProps {
  draftSort: ShowcaseSort;
  onChange: (sort: ShowcaseSort) => void;
  onReset: () => void;
  onApply: () => void;
}

const inputClassName = 'mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white';

const ShinyShowcaseSortPanel = ({
  draftSort,
  onChange,
  onReset,
  onApply,
}: ShinyShowcaseSortPanelProps) => (
  <div
    role="dialog"
    aria-label="Sort shinies"
    className="absolute top-full left-1/2 -translate-x-1/2 z-20 mt-2 w-[min(92vw,24rem)] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-5 md:left-auto md:right-0 md:translate-x-0 md:w-full md:max-w-sm"
  >
    <div className="grid grid-cols-1 gap-4">
      <label className="text-sm text-gray-700 dark:text-gray-300">
        Sort by
        <select
          value={draftSort.sortBy}
          onChange={(event) => onChange({
            ...draftSort,
            sortBy: event.target.value as ShowcaseSort['sortBy'],
          })}
          className={inputClassName}
        >
          <option value="number_ot">Number OT</option>
          <option value="points">Points</option>
          <option value="points_per_num_ot">Average Points/Shiny</option>
        </select>
      </label>
      {draftSort.sortBy === 'points_per_num_ot' && (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <span>Minimum OT shinies</span>
          <NumberSpinner
            aria-label="Minimum OT shinies"
            className={`${inputClassName} !mt-0`}
            min={0}
            onValueChange={(value) => onChange({ ...draftSort, minNumOT: value })}
            step={1}
            value={draftSort.minNumOT}
            wrapperClassName="mt-1"
          />
        </div>
      )}
      <label className="text-sm text-gray-700 dark:text-gray-300">
        Order
        <select
          value={draftSort.sortOrder}
          onChange={(event) => onChange({
            ...draftSort,
            sortOrder: event.target.value as ShowcaseSort['sortOrder'],
          })}
          className={inputClassName}
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </label>
    </div>

    <div className="mt-5 flex justify-end gap-3">
      <button
        type="button"
        onClick={onReset}
        className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
      >
        Reset
      </button>
      <button
        type="button"
        onClick={onApply}
        className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold"
      >
        Apply
      </button>
    </div>
  </div>
);

export default ShinyShowcaseSortPanel;
