type Props = {
  season: string;
  selectedSeason?: string;
  selectedTime?: string;
  time: string;
  times?: string[];
  onSeasonChange?: (season: string) => void;
  onTimeChange?: (time: string) => void;
};

const baseClasses = 'rounded-full px-2.5 py-1 text-xs font-semibold transition-colors';
const inactiveClasses = 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700';
const activeClasses = 'bg-primary-100 text-primary-800 ring-1 ring-primary-300 dark:bg-primary-950 dark:text-primary-200 dark:ring-primary-800';

function FilterChip({ active, ariaLabel, children, onClick }: {
  active: boolean;
  ariaLabel: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`${baseClasses} ${active ? activeClasses : inactiveClasses}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export default function HuntFilterChips({
  season, selectedSeason = '', selectedTime = '', time, times, onSeasonChange, onTimeChange,
}: Props) {
  const availableTimes = time === 'Any' ? [] : (times?.length ? times : [time]);
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2" aria-label="Location season and time filters">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-gray-500">Season</span>
        <FilterChip active={!selectedSeason} ariaLabel="Any season" onClick={() => onSeasonChange?.('')}>Any</FilterChip>
        {season !== 'Any' && (
          <FilterChip active={selectedSeason === season} ariaLabel={`${season} season`} onClick={() => onSeasonChange?.(season)}>
            {season}
          </FilterChip>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-gray-500">Time</span>
        <FilterChip active={!selectedTime} ariaLabel="Any time" onClick={() => onTimeChange?.('')}>Any</FilterChip>
        {availableTimes.map((availableTime) => (
          <FilterChip
            active={selectedTime === availableTime}
            ariaLabel={`${titleCase(availableTime)} time`}
            key={availableTime}
            onClick={() => onTimeChange?.(availableTime)}
          >
            {titleCase(availableTime)}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}
