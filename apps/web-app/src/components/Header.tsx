import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from './ThemeToggle';

const toolsLinks = [
  {
    href: '/feebas-tile-checker',
    label: 'Feebas Tile Tracker',
  },
];

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-md py-2' 
          : 'bg-transparent py-4'
      }`}
    >
      <div className="container flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
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
            href="/" 
            className="font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
          >
            Home
          </a>
          <a 
            href="/shiny-showcase" 
            className="font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
          >
            Shiny Showcase
          </a>
          <a 
            href="/events" 
            className="font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
          >
            Events
          </a>
          <div className="group relative">
            <a
              href="/tools"
              className="flex items-center gap-2 font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
              aria-haspopup="true"
            >
              Tools
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
                {toolsLinks.map((link) => (
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
            Forum
          </a>
          <a 
            href="/discord" 
            className="font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
          >
            Discord
          </a>
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
            aria-label="Toggle menu"
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
                href="/" 
                className="py-2 font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Home
              </a>
              <a 
                href="/shiny-showcase" 
                className="py-2 font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Shiny Showcase
              </a>
             <a 
                href="/events" 
                className="py-2 font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Events
              </a>
              <a
                href="/tools"
                className="py-2 font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Tools
              </a>
              <div className="pl-4 -mt-2 flex flex-col gap-2">
                {toolsLinks.map((link) => (
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
                Forum
              </a>
              <a 
                href="/discord" 
                className="py-2 font-medium text-gray-800 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Discord
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
