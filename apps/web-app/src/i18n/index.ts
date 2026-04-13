import { DEFAULT_LOCALE, type Locale, resolveLocale } from './config';
import en from './locales/en';
import es from './locales/es';
import zh from './locales/zh';

export type Translations = typeof en;

type Primitive = string | number | boolean | null | undefined;

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Primitive ? T[K] : DeepPartial<T[K]>;
};

const localeOverrides: Record<Locale, DeepPartial<Translations>> = {
  en,
  es,
  zh,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeTranslations<T extends Record<string, unknown>>(base: T, overrides?: DeepPartial<T>): T {
  if (!overrides) {
    return base;
  }

  const mergedEntries = Object.entries(base).map(([key, value]) => {
    const overrideValue = overrides[key as keyof T];

    if (isObject(value) && isObject(overrideValue)) {
      return [key, mergeTranslations(value, overrideValue)];
    }

    return [key, overrideValue ?? value];
  });

  return Object.fromEntries(mergedEntries) as T;
}

const translationCache = new Map<Locale, Translations>();

export function getTranslations(localeInput?: string | null): Translations {
  const locale = resolveLocale(localeInput);
  const cached = translationCache.get(locale);

  if (cached) {
    return cached;
  }

  if (locale === DEFAULT_LOCALE) {
    translationCache.set(locale, en);
    return en;
  }

  const merged = mergeTranslations(en, localeOverrides[locale]);
  translationCache.set(locale, merged);
  return merged;
}

export function getLocaleParamPath(pathname: string, localeInput?: string | null) {
  const locale = resolveLocale(localeInput);

  if (locale === DEFAULT_LOCALE) {
    return pathname;
  }

  const separator = pathname.includes('?') ? '&' : '?';
  return `${pathname}${separator}lang=${encodeURIComponent(locale)}`;
}

export function detectBrowserLocale(
  preferredLanguages: readonly string[] | undefined | null,
  storedLocale?: string | null
): Locale {
  const resolvedStoredLocale = resolveLocale(storedLocale);
  if (storedLocale && resolvedStoredLocale !== DEFAULT_LOCALE) {
    return resolvedStoredLocale;
  }

  for (const language of preferredLanguages || []) {
    const resolved = resolveLocale(language);
    if (resolved !== DEFAULT_LOCALE || language.toLowerCase().startsWith(DEFAULT_LOCALE)) {
      return resolved;
    }
  }

  return DEFAULT_LOCALE;
}

export function getRuntimeLocale(localeInput?: string | null): Locale {
  const resolvedInput = resolveLocale(localeInput);
  if (localeInput && resolvedInput !== DEFAULT_LOCALE) {
    return resolvedInput;
  }

  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  const queryLocale = window.location ? new URLSearchParams(window.location.search).get('lang') : null;
  const resolvedQueryLocale = resolveLocale(queryLocale);
  if (queryLocale && (resolvedQueryLocale !== DEFAULT_LOCALE || queryLocale.toLowerCase().startsWith(DEFAULT_LOCALE))) {
    return resolvedQueryLocale;
  }

  let storedLocale: string | null = null;
  try {
    storedLocale = window.localStorage.getItem('team-soju-locale');
  } catch {
    storedLocale = null;
  }

  return detectBrowserLocale(window.navigator?.languages, storedLocale);
}

export { DEFAULT_LOCALE, resolveLocale };
export type { Locale };
