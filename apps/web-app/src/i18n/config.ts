export const SUPPORTED_LOCALES = ['en', 'es', 'zh'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

const LOCALE_ALIASES: Record<string, Locale> = {
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  es: 'es',
  'es-es': 'es',
  'es-419': 'es',
  zh: 'zh',
  'zh-cn': 'zh',
  'zh-sg': 'zh',
  'zh-hans': 'zh',
  'zh-tw': 'zh',
  'zh-hk': 'zh',
  'zh-hant': 'zh',
};

export function isLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function resolveLocale(input?: string | null): Locale {
  if (!input) {
    return DEFAULT_LOCALE;
  }

  const normalized = input.trim().toLowerCase();
  if (LOCALE_ALIASES[normalized]) {
    return LOCALE_ALIASES[normalized];
  }

  const parts = normalized.split('-');
  while (parts.length > 1) {
    parts.pop();
    const candidate = parts.join('-');
    if (LOCALE_ALIASES[candidate]) {
      return LOCALE_ALIASES[candidate];
    }
  }

  return DEFAULT_LOCALE;
}
