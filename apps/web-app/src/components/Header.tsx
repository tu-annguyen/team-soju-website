import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from './ThemeToggle';
import LanguagePicker from './LanguagePicker';
import {
  getClientLocale,
  getLocaleParamPath,
  getTranslations,
  type Locale,
} from '../i18n';

const toolsLinks = [
  {
    href: '/feebas-tile-checker',
    label: 'Feebas Tile Tracker',
  },
];

type Props = {
  locale?: Locale | string;
  apiBaseUrl?: string;
};

type AuthUser = {
  id: string;
  email: string;
  ign: string;
};

const Header = ({ locale, apiBaseUrl }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeLocale, setActiveLocale] = useState<Locale>(() => getClientLocale(locale));
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const normalizedApiBaseUrl = apiBaseUrl?.replace(/\/+$/, '');
  const messages = getTranslations(activeLocale);
  const homeHref = getLocaleParamPath('/', activeLocale);
  const shinyShowcaseHref = getLocaleParamPath('/shiny-showcase', activeLocale);
  const eventsHref = getLocaleParamPath('/events', activeLocale);
  const toolsHref = getLocaleParamPath('/tools', activeLocale);
  const discordHref = getLocaleParamPath('/discord', activeLocale);
  const authHref = getLocaleParamPath('/auth', activeLocale);
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

  useEffect(() => {
    const handleAuthUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<AuthUser | null>;
      setAuthUser(customEvent.detail || null);
    };

    window.addEventListener('team-soju-auth-updated', handleAuthUpdated);

    return () => {
      window.removeEventListener('team-soju-auth-updated', handleAuthUpdated);
    };
  }, []);

  useEffect(() => {
    if (!normalizedApiBaseUrl || typeof fetch !== 'function') {
      return;
    }

    let isMounted = true;

    async function loadAuthUser() {
      try {
        const response = await fetch(`${normalizedApiBaseUrl}/auth/me`, {
          credentials: 'include',
        });
        const body = await response.json();

        if (isMounted && response.ok && body.success) {
          setAuthUser(body.data || null);
        }
      } catch {
        if (isMounted) {
          setAuthUser(null);
        }
      }
    }

    loadAuthUser();

    return () => {
      isMounted = false;
    };
  }, [normalizedApiBaseUrl]);

  const handleLocaleChange = (nextLocale: Locale) => {
    setActiveLocale(nextLocale);
    setIsOpen(false);
    setIsMobileToolsOpen(false);
  };

  const handleSignOut = async () => {
    if (normalizedApiBaseUrl && typeof fetch === 'function') {
      try {
        await fetch(`${normalizedApiBaseUrl}/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        // The local header state can still clear even if the network request fails.
      }
    }

    setAuthUser(null);
    setIsOpen(false);
    setIsMobileToolsOpen(false);
    window.dispatchEvent(new CustomEvent('team-soju-auth-updated', { detail: null }));
  };

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
        <nav className="hidden min-[1010px]:flex items-center gap-6">
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
          {authUser ? (
            <div className="flex items-center gap-3">
              <a
                href={authHref}
                className="max-w-32 truncate rounded-lg bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:bg-gray-800 dark:text-primary-300 dark:hover:bg-gray-700"
                title={messages.nav.account}
              >
                {authUser.ign}
              </a>
              <button
                type="button"
                className="text-sm font-semibold text-gray-700 transition-colors hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400"
                onClick={handleSignOut}
              >
                {messages.nav.signOut}
              </button>
            </div>
          ) : (
            <a
              href={authHref}
              className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
            >
              {messages.nav.signIn}
            </a>
          )}
          <LanguagePicker locale={activeLocale} className="ml-2" onLocaleChange={handleLocaleChange} />
          <div className="ml-4">
            <ThemeToggle />
          </div>
        </nav>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-4 min-[1010px]:hidden">
          <ThemeToggle />
          <button 
            onClick={() => {
              setIsOpen(!isOpen);
              if (isOpen) {
                setIsMobileToolsOpen(false);
              }
            }}
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
            className="min-[1010px]:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700"
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
              <button
                type="button"
                className="flex items-center justify-between py-2 font-medium text-gray-800 transition-colors hover:text-primary-500 dark:text-gray-200 dark:hover:text-primary-400"
                onClick={() => setIsMobileToolsOpen((current) => !current)}
                aria-expanded={isMobileToolsOpen}
                aria-controls="mobile-tools-menu"
              >
                <span>{messages.nav.tools}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className={`h-4 w-4 transition-transform duration-200 ${isMobileToolsOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              <AnimatePresence initial={false}>
                {isMobileToolsOpen && (
                  <motion.div
                    id="mobile-tools-menu"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pl-4 -mt-2 flex flex-col gap-2">
                      {localizedToolLinks.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          className="py-1 text-sm font-medium text-gray-700 transition-colors hover:text-primary-500 dark:text-gray-300 dark:hover:text-primary-400"
                          onClick={() => {
                            setIsMobileToolsOpen(false);
                            setIsOpen(false);
                          }}
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
              {authUser ? (
                <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                  <a
                    href={authHref}
                    className="py-2 font-medium text-gray-800 transition-colors hover:text-primary-500 dark:text-gray-200 dark:hover:text-primary-400"
                    onClick={() => setIsOpen(false)}
                  >
                    {authUser.ign}
                  </a>
                  <button
                    type="button"
                    className="py-2 text-left font-medium text-gray-800 transition-colors hover:text-primary-500 dark:text-gray-200 dark:hover:text-primary-400"
                    onClick={handleSignOut}
                  >
                    {messages.nav.signOut}
                  </button>
                </div>
              ) : (
                <a
                  href={authHref}
                  className="py-2 font-medium text-gray-800 transition-colors hover:text-primary-500 dark:text-gray-200 dark:hover:text-primary-400"
                  onClick={() => setIsOpen(false)}
                >
                  {messages.nav.signIn}
                </a>
              )}
              <div className="pt-2">
                <LanguagePicker locale={activeLocale} className="block" onLocaleChange={handleLocaleChange} />
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
