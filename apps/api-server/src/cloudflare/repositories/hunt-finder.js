const ENCOUNTER_METHODS = Object.freeze({
  'Sweet Scent': ['Sweet Scent'],
  Singles: ['Grass', 'Cave', 'Water', 'Inside', 'Dark Grass', 'Dust Cloud', 'Shadow'],
  Fishing: ['Super Rod', 'Good Rod', 'Old Rod', 'Fishing'],
  'Honey Trees': ['Honey Tree'],
  Headbutt: ['Headbutt'],
  'Rock Smash': ['Rock Smash', 'Rocks'],
});

const FISHING_METHODS = new Set(ENCOUNTER_METHODS.Fishing);
const METHODS_WITHOUT_HOURLY_DATA = new Set(['Headbutt', 'Rock Smash', 'Rocks']);
const EV_COLUMNS = Object.freeze({
  hp: 'ev_hp',
  attack: 'ev_attack',
  defense: 'ev_defense',
  spAttack: 'ev_sp_attack',
  spDefense: 'ev_sp_defense',
  speed: 'ev_speed',
});

function isSpecialEncounterRow(row) {
  if (Number(row.horde_size) > 0) return false;
  if (row.is_special === true || Number(row.is_special) === 1) return true;
  const hasNoRecordedRates = ['morning', 'day', 'night'].every(
    (time) => row[`${time}_rate`] === null || row[`${time}_rate`] === undefined
  );
  const hasLegacySpecialRate = hasNoRecordedRates
    || row.is_lure === true
    || Number(row.is_lure) === 1;
  if (!hasLegacySpecialRate) return false;
  return (row.region === 'Unova' && row.season !== 'Any')
    || ['Dust Cloud', 'Shadow'].includes(row.method)
    || row.slug === 'feebas'
    || (row.region === 'Unova' && row.location_name === 'Marvelous Bridge' && row.slug === 'swanna');
}

function encounterRatePerHour(row, filters) {
  if (Number(row.horde_size) > 0) {
    return (Number(filters.hordesPerHour) || 240) * Number(row.horde_size);
  }
  if (row.method === 'Dark Grass') return 400;
  if (FISHING_METHODS.has(row.method)) return filters.chumBucket ? 400 : 200;
  if (row.method === 'Honey Tree') return 50;
  if (METHODS_WITHOUT_HOURLY_DATA.has(row.method)) return null;
  return 300;
}

function normalizeFamilyKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[ .]+/g, '-');
}

function meetsMinimumTier(species, minTier) {
  const tier = Number(String(species.tier || '').match(/^Tier ([0-7])$/)?.[1]);
  return Number.isInteger(tier) && tier <= minTier;
}

function calculateExperienceMetrics(composition, encountersPerHour, expCharm, boosts = {}) {
  const averageExp = composition.reduce((sum, species) => {
    const averageLevel = (Number(species.min_level) + Number(species.max_level)) / 2;
    return sum + (((Number(species.base_exp) * averageLevel) / 7) * Number(species.split || 0));
  }, 0);
  const charm = [0.25, 0.5, 1].includes(Number(expCharm)) ? Number(expCharm) : 0;
  const boostMultiplier = (boosts.expReamplifier ? 0.05 : 0)
    + (boosts.expDonator ? 0.25 : 0)
    + (boosts.tradeBonus ? 0.15 : 0);
  return {
    averageExp,
    expPerHour: encountersPerHour === null
      ? null
      : averageExp * encountersPerHour * (1 + charm + boostMultiplier),
  };
}

function matchesEvYield(spot, stats = [], amounts = []) {
  const columns = stats.map((stat) => EV_COLUMNS[stat]).filter(Boolean);
  const yields = new Set(amounts.map(Number).filter((amount) => amount === 1 || amount === 2));
  if (!columns.length || !yields.size) return true;
  return spot.composition.some(
    (species) => columns.some((column) => yields.has(Number(species[column])))
  );
}

function compareNullable(left, right, direction) {
  if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
  if (right === null || right === undefined) return -1;
  return direction * (Number(left) - Number(right));
}

function sortHuntSpots(spots, filters, hasHourlyData) {
  const direction = filters.sortDirection === 'asc' ? 1 : -1;
  const requestedSort = filters.sort || 'pointsPerHour';
  const sort = requestedSort === 'expPerHour' && ![undefined, 'All', 'Sweet Scent'].includes(filters.method)
    ? 'alphabetical'
    : requestedSort;
  spots.sort((left, right) => {
    if (sort === 'alphabetical') {
      return direction * left.location.localeCompare(right.location)
        || left.region.localeCompare(right.region);
    }
    if (sort === 'averagePoints' || !hasHourlyData) {
      return compareNullable(left.averagePoints, right.averagePoints, direction)
        || left.location.localeCompare(right.location);
    }
    const field = sort === 'expPerHour' ? 'expPerHour' : 'pointsPerHour';
    return compareNullable(left[field], right[field], direction)
      || left.location.localeCompare(right.location);
  });
}

module.exports = {
  ENCOUNTER_METHODS,
  calculateExperienceMetrics,
  encounterRatePerHour,
  isSpecialEncounterRow,
  matchesEvYield,
  meetsMinimumTier,
  normalizeFamilyKey,
  sortHuntSpots,
};
