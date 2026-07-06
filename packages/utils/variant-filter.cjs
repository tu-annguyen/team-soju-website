const GENERATION_V_OR_EARLIER_VERSION_GROUPS = new Set([
  'red-green-japan',
  'red-blue',
  'yellow',
  'gold-silver',
  'crystal',
  'ruby-sapphire',
  'emerald',
  'firered-leafgreen',
  'colosseum',
  'xd',
  'diamond-pearl',
  'platinum',
  'heartgold-soulsilver',
  'black-white',
  'black-2-white-2',
]);

function normalizePokemonName(value) {
  return String(value || '').trim().toLowerCase();
}

function isGenerationVOrEarlierVersionGroup(versionGroupName) {
  return GENERATION_V_OR_EARLIER_VERSION_GROUPS.has(normalizePokemonName(versionGroupName));
}

function isEntryIntroducedByGenerationV(entry, speciesName) {
  const introducedVersionGroup = normalizePokemonName(entry?.introduced_in_version_group);
  if (introducedVersionGroup) {
    return isGenerationVOrEarlierVersionGroup(introducedVersionGroup);
  }

  const normalizedSpecies = normalizePokemonName(speciesName);
  return !normalizedSpecies || normalizePokemonName(entry?.value) === normalizedSpecies;
}

async function filterEntriesToGenerationV(entries, {
  speciesName = null,
  hasGenerationVSpriteForName,
} = {}) {
  if (typeof hasGenerationVSpriteForName !== 'function') {
    throw new TypeError('hasGenerationVSpriteForName must be a function');
  }

  const spriteAvailabilityCache = new Map();
  const filteredEntries = await Promise.all((entries || []).map(async (entry) => {
    if (!entry?.value) return null;
    if (!isEntryIntroducedByGenerationV(entry, speciesName)) return null;

    const spriteCheckName = normalizePokemonName(entry.sprite_check_name || entry.value);
    if (!spriteAvailabilityCache.has(spriteCheckName)) {
      spriteAvailabilityCache.set(spriteCheckName, Boolean(await hasGenerationVSpriteForName(spriteCheckName)));
    }

    return spriteAvailabilityCache.get(spriteCheckName) ? entry : null;
  }));

  return filteredEntries.filter(Boolean);
}

module.exports = {
  filterEntriesToGenerationV,
  isEntryIntroducedByGenerationV,
  isGenerationVOrEarlierVersionGroup,
};
