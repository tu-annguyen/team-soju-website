import {
  detectBrowserLocale,
  getLocaleParamPath,
  getRuntimeLocale,
  getTranslations,
  resolveLocale,
} from '../src/i18n';

describe('i18n helpers', () => {
  it('resolves locale aliases to supported locales', () => {
    expect(resolveLocale('en-US')).toBe('en');
    expect(resolveLocale('es-419')).toBe('es');
    expect(resolveLocale('zh-TW')).toBe('zh');
    expect(resolveLocale('zh-Hans-CN')).toBe('zh');
  });

  it('falls back to English when the locale is unsupported', () => {
    expect(resolveLocale('fr')).toBe('en');
    expect(getTranslations('fr').nav.home).toBe('Home');
  });

  it('returns translated copy for supported locales', () => {
    expect(getTranslations('es').nav.home).toBe('Inicio');
    expect(getTranslations('zh').footer.joinTitle).toBe('加入我们');
  });

  it('builds localized internal paths for non-default locales', () => {
    expect(getLocaleParamPath('/tools', 'en')).toBe('/tools');
    expect(getLocaleParamPath('/tools', 'es')).toBe('/tools?lang=es');
    expect(getLocaleParamPath('/discord?foo=bar', 'zh')).toBe('/discord?foo=bar&lang=zh');
  });

  it('prefers a saved non-default locale when detecting browser language', () => {
    expect(detectBrowserLocale(['en-US'], 'zh')).toBe('zh');
  });

  it('detects a supported browser locale and otherwise falls back to English', () => {
    expect(detectBrowserLocale(['es-419', 'en-US'])).toBe('es');
    expect(detectBrowserLocale(['zh-Hans-CN'])).toBe('zh');
    expect(detectBrowserLocale(['fr-FR'])).toBe('en');
  });

  it('does not let the default English prop block browser locale detection', () => {
    window.history.replaceState({}, '', '/feebas-tile-checker');
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['zh-Hans-CN', 'en-US'],
    });

    expect(getRuntimeLocale('en')).toBe('zh');
  });
});
