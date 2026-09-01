const EV_STATS = new Set(['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed']);
const SORTS = new Set(['pointsPerHour', 'expPerHour', 'alphabetical', 'averagePoints']);

function boolParam(searchParams, name, fallback = false) {
  const value = searchParams.get(name);
  return value === null ? fallback : value === 'true';
}

function listParam(searchParams, name) {
  return String(searchParams.get(name) || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function huntFinderFilters(url, { includeWarFilters = false } = {}) {
  const { searchParams } = url;
  const method = searchParams.get('method') || undefined;
  const requestedSort = searchParams.get('sort') || 'alphabetical';
  const sort = SORTS.has(requestedSort) ? requestedSort : 'alphabetical';
  const requestedDirection = searchParams.get('sortDirection');
  const evAmounts = listParam(searchParams, 'evAmounts').filter((amount) => amount === '1' || amount === '2');
  const filters = {
    season: searchParams.get('season') || undefined,
    region: searchParams.get('region') || undefined,
    location: searchParams.get('location') || undefined,
    method,
    hordeSize: searchParams.get('hordeSize') || undefined,
    minTier: searchParams.get('minTier') || undefined,
    minLevel: searchParams.get('minLevel') || undefined,
    species: searchParams.get('species') || undefined,
    time: searchParams.get('time') || undefined,
    fullSplitOnly: boolParam(searchParams, 'fullSplitOnly'),
    chumBucket: boolParam(searchParams, 'chumBucket'),
    nonSafari: boolParam(searchParams, 'nonSafari'),
    minPointsPerHour: searchParams.get('minPointsPerHour') || undefined,
    minExpPerHour: searchParams.get('minExpPerHour') || undefined,
    evStats: listParam(searchParams, 'evStats').filter((stat) => EV_STATS.has(stat)),
    evAmounts: evAmounts.slice(0, 1),
    expCharm: ['0.25', '0.5', '1'].includes(searchParams.get('expCharm'))
      ? Number(searchParams.get('expCharm'))
      : 0,
    expReamplifier: boolParam(searchParams, 'expReamplifier'),
    expDonator: boolParam(searchParams, 'expDonator'),
    tradeBonus: boolParam(searchParams, 'tradeBonus'),
    sort: sort === 'expPerHour' && ![undefined, 'All', 'Sweet Scent'].includes(method) ? 'alphabetical' : sort,
    sortDirection: requestedDirection === 'asc' || requestedDirection === 'desc'
      ? requestedDirection
      : sort === 'alphabetical' ? 'asc' : 'desc',
    page: searchParams.get('page') || undefined,
    pageSize: searchParams.get('pageSize') || undefined,
    hordesPerHour: Number(searchParams.get('hordesPerHour')) || 240,
    profile: {
      eventBoost: boolParam(searchParams, 'eventBoost'),
      donator: boolParam(searchParams, 'donator'),
      personalCharm: boolParam(searchParams, 'personalCharm'),
      linkCharm: boolParam(searchParams, 'linkCharm'),
    },
  };
  if (!includeWarFilters) return filters;
  return {
    ...filters,
    officialUniqueBonus: boolParam(searchParams, 'officialUniqueBonus', true),
    teamUniqueBonus: boolParam(searchParams, 'teamUniqueBonus'),
    excludeOfficialCaught: boolParam(searchParams, 'excludeOfficialCaught'),
    excludeTeamCaught: boolParam(searchParams, 'excludeTeamCaught'),
    officialCaughtFamilyKeys: listParam(searchParams, 'officialCaughtFamilyKeys'),
    teamCaughtFamilyKeys: listParam(searchParams, 'teamCaughtFamilyKeys'),
    playerCaughtFamilyKeys: listParam(searchParams, 'playerCaughtFamilyKeys'),
  };
}

module.exports = { huntFinderFilters };
