function inferDateOrderFromLocale(locale) {
  const normalizedLocale = String(locale || '').trim().replace(/_/g, '-');
  if (!normalizedLocale) return null;

  try {
    const order = new Intl.DateTimeFormat(normalizedLocale, {
      year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC',
    }).formatToParts(new Date(Date.UTC(2006, 10, 22)))
      .map(({ type }) => ({ year: 'y', month: 'm', day: 'd' }[type]))
      .filter(Boolean)
      .join('');
    return ({ mdy: 'mdy', dmy: 'dmy', ymd: 'ymd' })[order] || null;
  } catch {
    return null;
  }
}

module.exports = { inferDateOrderFromLocale };
