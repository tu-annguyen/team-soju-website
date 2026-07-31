const SEASONS = ['Summer', 'Autumn', 'Winter', 'Spring'];
const TIMES = ['morning', 'day', 'night'];
const FLOOR_SUFFIX = /\s*(?:[-–—,]\s*)?(?:\((B?\d+F|(?:Floor|Level)\s+\d+)\)|(B?\d+F|(?:Floor|Level)\s+\d+))$/i;

function parentLocationName(location) {
  return String(location || '').replace(FLOOR_SUFFIX, '').trim();
}

function locationAreaName(location) {
  const match = String(location || '').match(FLOOR_SUFFIX);
  return match ? (match[1] || match[2]) : '';
}

function comparableSpot(spot, omittedFields = []) {
  const omitted = new Set(['spot_key', 'spot_keys', 'location_areas', 'location_id', ...omittedFields]);
  return Object.fromEntries(Object.entries(spot)
    .filter(([key]) => !omitted.has(key))
    .map(([key, value]) => [
      key,
      key === 'composition'
        ? value.map(({ min_level, max_level, ...species }) => species)
        : value,
    ]));
}

function spotSignature(spot, omittedFields = [], includeLocationAreas = false) {
  const comparable = comparableSpot(spot, omittedFields);
  if (includeLocationAreas) {
    comparable.location_areas = [...(spot.location_areas || [])].sort();
  }
  return JSON.stringify(comparable);
}

function deduplicateEquivalentLocations(spots) {
  const groups = new Map();
  spots.forEach((spot) => {
    const area = locationAreaName(spot.location);
    const normalized = {
      ...spot,
      location: parentLocationName(spot.location),
      location_areas: area ? [area] : [],
    };
    const signature = spotSignature(normalized);
    const group = groups.get(signature) || [];
    group.push(normalized);
    groups.set(signature, group);
  });
  return [...groups.values()].map((group) => mergeSpotGroup(group));
}

function mergeSpotGroup(group, overrides = {}) {
  const spotKeys = [...new Set(group.flatMap(
    (spot) => spot.spot_keys || [spot.spot_key]
  ))];
  const locationAreas = [...new Set(group.flatMap((spot) => spot.location_areas || []))];
  return { ...group[0], ...overrides, spot_keys: spotKeys, location_areas: locationAreas };
}

function collapseCompleteDimension(spots, field, expectedValues) {
  const groups = new Map();
  spots.forEach((spot) => {
    const signature = spotSignature(spot, [field], true);
    const group = groups.get(signature) || [];
    group.push(spot);
    groups.set(signature, group);
  });

  return [...groups.values()].flatMap((group) => {
    const values = new Set(group.map((spot) => spot[field]));
    const coversDimension = expectedValues.every((value) => values.has(value));
    if (!coversDimension) return group;
    return [mergeSpotGroup(group, { [field]: 'Any' })];
  });
}

function collapseEquivalentTimes(spots) {
  const groups = new Map();
  spots.forEach((spot) => {
    const signature = spotSignature(spot, ['time', 'times'], true);
    const group = groups.get(signature) || [];
    group.push(spot);
    groups.set(signature, group);
  });

  return [...groups.values()].map((group) => {
    const times = [...new Set(group.flatMap((spot) => spot.times || [spot.time]))]
      .sort((left, right) => TIMES.indexOf(left) - TIMES.indexOf(right));
    const coversWholeDay = TIMES.every((time) => times.includes(time));
    return mergeSpotGroup(group, { time: coversWholeDay ? 'Any' : times[0], times });
  });
}

function groupEquivalentHuntSpots(spots) {
  const locationGroups = deduplicateEquivalentLocations(spots);
  const timeGroups = collapseEquivalentTimes(locationGroups);
  return collapseCompleteDimension(timeGroups, 'season', SEASONS);
}

module.exports = {
  groupEquivalentHuntSpots,
  locationAreaName,
  parentLocationName,
};
