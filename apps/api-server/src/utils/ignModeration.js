const EXACT_IGN_BLACKLIST = [
  // Specific blocked names.
  'cock',
  'coon',
  'cunt',
  'dick',
];

const SUBSTRING_PROFANITY_BLACKLIST = require('./ignSubstringBlacklist.json');

function normalizeIgnForModeration(ign) {
  return String(ign || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function parseConfiguredEntries(value) {
  return String(value || '')
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getConfiguredExactIgnBlacklist() {
  return [
    ...EXACT_IGN_BLACKLIST,
    ...parseConfiguredEntries(process.env.IGN_BLACKLIST),
  ];
}

function getConfiguredSubstringProfanityBlacklist() {
  return [
    ...SUBSTRING_PROFANITY_BLACKLIST,
    ...parseConfiguredEntries(process.env.IGN_SUBSTRING_BLACKLIST),
  ];
}

function findExactBlacklistedIgnMatch(normalizedIgn) {
  return getConfiguredExactIgnBlacklist().find((entry) => (
    normalizeIgnForModeration(entry) === normalizedIgn
  )) || null;
}

function findSubstringBlacklistedIgnMatch(normalizedIgn) {
  return getConfiguredSubstringProfanityBlacklist().find((entry) => {
    const normalizedEntry = normalizeIgnForModeration(entry);

    return Boolean(normalizedEntry) && normalizedIgn.includes(normalizedEntry);
  }) || null;
}

function findBlacklistedIgnMatch(ign) {
  const normalizedIgn = normalizeIgnForModeration(ign);

  if (!normalizedIgn) {
    return null;
  }

  return findExactBlacklistedIgnMatch(normalizedIgn)
    || findSubstringBlacklistedIgnMatch(normalizedIgn);
}

function isIgnBlacklisted(ign) {
  return Boolean(findBlacklistedIgnMatch(ign));
}

module.exports = {
  EXACT_IGN_BLACKLIST,
  SUBSTRING_PROFANITY_BLACKLIST,
  findBlacklistedIgnMatch,
  isIgnBlacklisted,
  normalizeIgnForModeration,
};
