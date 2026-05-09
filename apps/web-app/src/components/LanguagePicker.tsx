import {
  getClientLocale,
  getLocaleOverrideUrl,
  getTranslations,
  navigateToLocaleOverride,
  type Locale,
} from '../i18n';

const localeStorageKey = 'team-soju-locale';

const languageOptions: Array<{ value: Locale; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'zh', label: '中文' },
];

type Props = {
  locale?: Locale | string;
  className?: string;
  selectClassName?: string;
  onLocaleChange?: (nextLocale: Locale) => void;
};

const defaultSelectClassName =
  'min-w-[8.5rem] appearance-none rounded-full border border-gray-300 bg-white py-2 pl-4 pr-11 text-sm font-medium text-gray-800 shadow-sm transition-colors focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

const LanguagePicker = ({
  locale,
  className,
  selectClassName = defaultSelectClassName,
  onLocaleChange,
}: Props) => {
  const activeLocale = getClientLocale(locale);
  const messages = getTranslations(activeLocale);

  const handleLocaleChange = (nextLocale: Locale) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(localeStorageKey, nextLocale);
    } catch {
      // Ignore storage failures so navigation still works.
    }

    onLocaleChange?.(nextLocale);
    navigateToLocaleOverride(getLocaleOverrideUrl(window.location.href, nextLocale));
  };

  return (
    <label className={className}>
      <span className="sr-only">{messages.nav.language}</span>
      <div className="relative inline-block">
        <select
          aria-label={messages.nav.language}
          className={selectClassName}
          value={activeLocale}
          onChange={(event) => handleLocaleChange(event.target.value as Locale)}
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-500 dark:text-gray-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.75}
            stroke="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </span>
      </div>
    </label>
  );
};

export default LanguagePicker;
