import { getTranslations, resolveLocale } from '../src/i18n';

describe('i18n helpers', () => {
  it('resolves locale aliases to supported locales', () => {
    expect(resolveLocale('en-US')).toBe('en');
    expect(resolveLocale('es-419')).toBe('es');
    expect(resolveLocale('zh-TW')).toBe('zh');
  });

  it('falls back to English when the locale is unsupported', () => {
    expect(resolveLocale('fr')).toBe('en');
    expect(getTranslations('fr').nav.home).toBe('Home');
  });

  it('returns translated copy for supported locales', () => {
    expect(getTranslations('es').nav.home).toBe('Inicio');
    expect(getTranslations('zh').footer.joinTitle).toBe('加入我们');
  });
});
