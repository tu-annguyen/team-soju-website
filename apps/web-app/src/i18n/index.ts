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

export { DEFAULT_LOCALE, resolveLocale };
export type { Locale };
