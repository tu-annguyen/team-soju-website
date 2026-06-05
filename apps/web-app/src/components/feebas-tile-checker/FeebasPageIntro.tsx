import React from 'react';
import { getClientLocale, getTranslations } from '../../i18n';
import type { Locale } from '../../i18n';

type Props = {
  locale?: Locale | string;
};

const FeebasPageIntro = ({ locale }: Props) => {
  const activeLocale = getClientLocale(locale);
  const messages = getTranslations(activeLocale);

  return (
    <section className="bg-gradient-to-br from-cyan-100 via-sky-100 to-teal-100 py-16 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container">
        <div className="max-w-4xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-sky-700 dark:text-sky-300">
            {messages.tools.feebas.eyebrow}
          </p>
          <h1 className="text-gray-900 dark:text-white">{messages.tools.feebas.heading}</h1>
          <p className="mt-4 text-lg text-slate-700 dark:text-slate-300">
            {messages.tools.feebas.intro}
          </p>
        </div>
      </div>
    </section>
  );
};

export default FeebasPageIntro;
