type ClockAttributeIconProps = {
  className?: string;
  kind: 'season' | 'timeOfDay';
  size?: 'sm' | 'md';
  value: string;
};

type IconDefinition = {
  color: string;
  name: string;
};

const SEASON_ICONS: Record<string, IconDefinition> = {
  Spring: { color: 'text-green-600 dark:text-green-400', name: 'seedling' },
  Summer: { color: 'text-amber-500 dark:text-amber-400', name: 'sun' },
  Autumn: { color: 'text-orange-600 dark:text-orange-400', name: 'leaf' },
  Winter: { color: 'text-sky-500 dark:text-sky-300', name: 'snowflake' },
};

const TIME_OF_DAY_ICONS: Record<string, IconDefinition> = {
  Morning: { color: 'text-orange-500 dark:text-orange-300', name: 'cloud-sun' },
  Day: { color: 'text-yellow-500 dark:text-yellow-300', name: 'sun' },
  Night: { color: 'text-indigo-500 dark:text-indigo-300', name: 'moon' },
};

function IconPaths({ name }: Pick<IconDefinition, 'name'>) {
  switch (name) {
    case 'seedling':
      return <>
        <path d="M12 21v-9" />
        <path d="M12 13C7 13 4 10 4 5c5 0 8 3 8 8Z" />
        <path d="M12 10c0-4 3-7 8-7 0 5-3 8-8 8" />
      </>;
    case 'sun':
      return <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
      </>;
    case 'leaf':
      return <>
        <path d="M20.5 3.5C13 3.5 6 6 4 12c-1.5 4.5 1.5 8 5.5 8 6 0 10-6.5 11-16.5Z" />
        <path d="M5 19c3-5 7-8 12-11" />
      </>;
    case 'snowflake':
      return <>
        <path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11" />
        <path d="m9 4 3 2 3-2M9 20l3-2 3 2M4.5 10l.5-3.5 3.5-.5M19.5 14l-.5 3.5-3.5.5M15.5 6l3.5.5.5 3.5M8.5 18 5 17.5 4.5 14" />
      </>;
    case 'cloud-sun':
      return <>
        <path d="M8 3v2M3.8 4.8l1.4 1.4M2 10h2M12.2 4.8l-1.4 1.4" />
        <path d="M5.2 12A4 4 0 1 1 12 8.2" />
        <path d="M7 20h11a4 4 0 0 0 .4-8A6 6 0 0 0 7 13a3.5 3.5 0 0 0 0 7Z" />
      </>;
    case 'moon':
      return <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />;
    default:
      return null;
  }
}

export default function ClockAttributeIcon({ className = '', kind, size = 'md', value }: ClockAttributeIconProps) {
  const icon = (kind === 'season' ? SEASON_ICONS : TIME_OF_DAY_ICONS)[value];
  if (!icon) return null;

  const dimensions = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';

  return (
    <svg
      aria-hidden="true"
      className={`${dimensions} inline-block shrink-0 ${icon.color} ${className}`}
      data-clock-icon={icon.name}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <IconPaths name={icon.name} />
    </svg>
  );
}
