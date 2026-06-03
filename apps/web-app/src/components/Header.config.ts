import type { Locale } from '../i18n';

export const toolsLinks = [
  {
    href: '/tools/catch-events',
    labelKey: 'catchEventsCard',
  },
  {
    href: '/feebas-tile-checker',
    labelKey: 'feebasCard',
  },
] as const;

export const localeStorageKey = 'team-soju-locale';

export const languageOptions: Array<{ value: Locale; label: string; code: string }> = [
  { value: 'en', label: 'English', code: 'EN' },
  { value: 'es', label: 'Español', code: 'ES' },
  { value: 'zh', label: '中文', code: 'ZH' },
];

export type AuthUser = {
  id: string;
  email: string;
  ign: string;
};
