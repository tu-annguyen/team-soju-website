import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from './ThemeToggle';
import {
  getClientLocale,
  getLocaleOverrideUrl,
  getLocaleParamPath,
  getTranslations,
  navigateToLocaleOverride,
  type Locale,
} from '../i18n';

const toolsLinks = [
  {
    href: '/feebas-tile-checker',
    label: 'Feebas Tile Tracker',
  },
];

const localeStorageKey = 'team-soju-locale';
const languageOptions: Array<{ value: Locale; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'zh', label: '中文' },
];

type Props = {
  locale?: Locale | string;
};

const Header = ({ locale }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeLocale, setActiveLocale] = useState<Locale>(() => getClientLocale(locale));
  const messages = getTranslations(activeLocale);
  const homeHref = getLocaleParamPath('/', activeLocale);
  const shinyShowcaseHref = getLocaleParamPath('/shiny-showcase', activeLocale);
  const eventsHref = getLocaleParamPath('/events', activeLocale);
  const toolsHref = getLocaleParamPath('/tools', activeLocale);
  const discordHref = getLocaleParamPath('/discord', activeLocale);
  const localizedToolLinks = toolsLinks.map((link) => ({
    ...link,
    href: getLocaleParamPath(link.href, activeLocale),
  }));

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setActiveLocale(getClientLocale(locale));
  }, [locale]);

  const handleLocaleChange = (nextLocale: Locale) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(localeStorageKey, nextLocale);
    } catch {
      // Ignore storage failures so navigation still works.
    }

    setActiveLocale(nextLocale);
    setIsOpen(false);
    navigateToLocaleOverride(getLocaleOverrideUrl(window.location.href, nextLocale));
  };

  const languagePicker = (className: string) => (
    <label className={className}>
      <span className="sr-only">{messages.nav.language}</span>
      <div className="relative inline-block">
        <select
          aria-label={messages.nav.language}
          className="min-w-[8.5rem] appearance-none rounded-full border border-gray-300 bg-white py-2 pl-4 pr-11 text-sm font-medium text-gray-800 shadow-sm transition-colors focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
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

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-md py-2' 
          : 'bg-transparent py-4'
      }`}
    >
      <div className="container flex items-center justify-between">
        <a href={homeHref} className="flex items-center gap-2">
          <img 
            src="/images/team-soju-icon.png" 
            alt="Team Soju Logo" 
            className="w-10 h-10 object-contain"
          />
          <span className="font-display text-xl font-bold text-primary-600 dark:text-primary-400">
            Team Soju
          </span>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <a 
            href={homeHref} 
            className="font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
          >
            {messages.nav.home}
          </a>
          <a 
            href={shinyShowcaseHref} 
            className="font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
          >
            {messages.nav.shinyShowcase}
          </a>
          <a 
            href={eventsHref} 
            className="font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
          >
            {messages.nav.events}
          </a>
          <div className="group relative">
            <a
              href={toolsHref}
              className="flex items-center gap-2 font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
              aria-haspopup="true"
            >
              {messages.nav.tools}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4 transition-transform duration-200 group-hover:rotate-180 group-focus-within:rotate-180"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </a>
            <div className="pointer-events-none absolute left-0 top-full pt-3 opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
              <div className="min-w-56 rounded-2xl border border-gray-200 bg-white/95 p-2 shadow-xl backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/95">
                {localizedToolLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="block rounded-xl px-4 py-3 text-sm font-medium text-gray-800 transition-colors hover:bg-primary-50 hover:text-primary-600 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-primary-400"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
          <a 
            href="https://forums.pokemmo.com/index.php?/clubs/261-soj%C3%BC-sojusanctuary/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
          >
            {messages.nav.forum}
          </a>
          <a 
            href={discordHref} 
            className="font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
          >
            {messages.nav.discord}
          </a>
          {languagePicker('ml-2')}
          <div className="ml-4">
            <ThemeToggle />
          </div>
        </nav>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-4 md:hidden">
          <ThemeToggle />
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="text-gray-800 dark:text-gray-200 focus:outline-none"
            aria-label={messages.nav.toggleMenu}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={1.5} 
              stroke="currentColor" 
              className="w-6 h-6"
            >
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700"
          >
            <nav className="container py-4 flex flex-col gap-4">
              <a 
                href={homeHref} 
                className="py-2 font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {messages.nav.home}
              </a>
              <a 
                href={shinyShowcaseHref} 
                className="py-2 font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {messages.nav.shinyShowcase}
              </a>
             <a 
                href={eventsHref} 
                className="py-2 font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {messages.nav.events}
              </a>
              <a
                href={toolsHref}
                className="py-2 font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {messages.nav.tools}
              </a>
              <div className="pl-4 -mt-2 flex flex-col gap-2">
                {localizedToolLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="py-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
              <a 
                href="https://forums.pokemmo.com/index.php?/clubs/261-soj%C3%BC-sojusanctuary/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="py-2 font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {messages.nav.forum}
              </a>
              <a 
                href={discordHref} 
                className="py-2 font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {messages.nav.discord}
              </a>
              <div className="pt-2">
                {languagePicker('block')}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
