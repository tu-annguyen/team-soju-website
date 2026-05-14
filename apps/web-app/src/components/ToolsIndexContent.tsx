import React from 'react';
import { getClientLocale, getLocaleParamPath, getTranslations } from '../i18n';
import type { Locale } from '../i18n';

type Props = {
  locale?: Locale | string;
};

const ToolsIndexContent = ({ locale }: Props) => {
  const activeLocale = getClientLocale(locale);
  const messages = getTranslations(activeLocale);
  const feebasHref = getLocaleParamPath('/feebas-tile-checker', activeLocale);
  const catchEventsHref = getLocaleParamPath('/tools/catch-events/create', activeLocale);

  return (
    <>
      <div className="py-16 bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container">
          <div className="mb-12">
            <h1 className="text-center text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              {messages.tools.index.heading}
            </h1>
            <p className="text-center text-gray-700 dark:text-gray-300 max-w-3xl mx-auto">
              {messages.tools.index.intro}
            </p>
          </div>
        </div>
      </div>

      <section className="py-16">
        <div className="container">
          <div className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
              {messages.tools.index.availableTitle}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-8">
              {messages.tools.index.availableDescription}
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <a
                href={catchEventsHref}
                className="group rounded-3xl border border-emerald-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-emerald-900 dark:bg-gray-900"
              >
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-300">
                  {messages.tools.index.categories.eventOps}
                </p>
                <h3 className="text-2xl font-bold text-gray-900 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                  {messages.tools.index.catchEventsCard.title}
                </h3>
                <p className="mt-4 text-gray-700 dark:text-gray-300">
                  {messages.tools.index.catchEventsCard.description}
                </p>
                <span className="mt-6 inline-flex items-center text-sm font-semibold text-primary-600 dark:text-primary-400">
                  {messages.tools.index.openTool}
                </span>
              </a>
              <a
                href={feebasHref}
                className="group rounded-3xl border border-cyan-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-cyan-900 dark:bg-gray-900"
              >
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-sky-700 dark:text-sky-300">
                  {messages.tools.index.categories.liveCoordination}
                </p>
                <h3 className="text-2xl font-bold text-gray-900 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                  {messages.tools.index.feebasCard.title}
                </h3>
                <p className="mt-4 text-gray-700 dark:text-gray-300">
                  {messages.tools.index.feebasCard.description}
                </p>
                <span className="mt-6 inline-flex items-center text-sm font-semibold text-primary-600 dark:text-primary-400">
                  {messages.tools.index.openTool}
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default ToolsIndexContent;
