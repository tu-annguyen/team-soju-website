import React from 'react';
import { getClientLocale, getLocaleParamPath, getTranslations } from '../i18n';
import type { Locale } from '../i18n';
import LanguagePicker from './LanguagePicker';

type Props = {
  locale?: Locale | string;
};

const Footer = ({ locale = 'en' }: Props) => {
  const currentYear = new Date().getFullYear();
  const activeLocale = getClientLocale(locale);
  const messages = getTranslations(activeLocale);
  const homeHref = getLocaleParamPath('/', activeLocale);
  const shinyShowcaseHref = getLocaleParamPath('/shiny-showcase', activeLocale);
  const eventsHref = getLocaleParamPath('/events', activeLocale);
  const toolsHref = getLocaleParamPath('/tools', activeLocale);
  const discordHref = getLocaleParamPath('/discord', activeLocale);
  
  return (
    <footer className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-8">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img 
                src="/images/team-soju-icon.png" 
                alt={messages.home.hero.logoAlt} 
                className="w-8 h-8 object-contain"
              />
              <span className="font-display text-lg font-bold text-primary-600 dark:text-primary-400">
                Team Soju
              </span>
            </div>
            <p className="mb-4 text-gray-600 dark:text-gray-400 text-sm">
              {messages.footer.blurb}
            </p>
            <div className="mb-4">
              <LanguagePicker
                locale={activeLocale}
                className="block"
                selectClassName="min-w-[8.5rem] appearance-none rounded-full border border-gray-300 bg-white py-2 pl-4 pr-11 text-sm font-medium text-gray-800 shadow-sm transition-colors focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">{messages.footer.linksTitle}</h3>
            <ul className="space-y-2">
              <li>
                <a 
                  href={homeHref} 
                  className="text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                >
                  {messages.nav.home}
                </a>
              </li>
              <li>
                <a 
                  href={shinyShowcaseHref} 
                  className="text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                >
                  {messages.nav.shinyShowcase}
                </a>
              </li>
              <li>
                <a 
                  href={eventsHref} 
                  className="text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                >
                  {messages.nav.events}
                </a>
              </li>
              <li>
                <a
                  href={toolsHref}
                  className="text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                >
                  {messages.nav.tools}
                </a>
              </li>
              <li>
                <a 
                  href="https://forums.pokemmo.com/index.php?/clubs/261-soj%C3%BC-sojusanctuary/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                >
                  {messages.nav.forum}
                </a>
              </li>
              <li>
                <a 
                  href={discordHref} 
                  className="text-gray-600 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                >
                  {messages.nav.discord}
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">{messages.footer.joinTitle}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              {messages.footer.joinDescription}
            </p>
            <a 
              href="https://forums.pokemmo.com/index.php?/topic/182111-team-soju-is-recruiting/#comment-2123917" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-primary text-sm px-4 py-2"
            >
              {messages.footer.applyNow}
            </a>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 text-center text-gray-500 dark:text-gray-400 text-sm">
          <p>© {currentYear} Team Soju. {messages.footer.rightsReserved}</p>
          <p className="mt-2">
            {messages.footer.legal}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
