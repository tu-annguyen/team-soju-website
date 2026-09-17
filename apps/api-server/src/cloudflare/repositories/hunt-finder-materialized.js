const {
  calculateHordeMetrics,
  effectiveShinyDenominator,
} = require('@team-soju/utils');
const { parentLocationName } = require('./hunt-spot-groups');
const {
  ENCOUNTER_METHODS,
  calculateExperienceMetrics,
  encounterRatePerHour,
} = require('./hunt-finder');

const EV_COLUMNS = {
  hp: 'ev_hp', attack: 'ev_attack', defense: 'ev_defense',
  spAttack: 'ev_sp_attack', spDefense: 'ev_sp_defense', speed: 'ev_speed',
};

function createMaterializedHuntFinder({ parameter, runOne, runSelect }) {
  let availability;
  const bind = (params, value) => { params.push(value); return parameter(params.length); };

  async function isAvailable() {
    if (!availability) {
      availability = Promise.resolve(runOne('SELECT COUNT(*) AS count FROM hunt_spots', []))
        .then((row) => Number(row?.count) > 0)
        .catch(() => false);
    }
    return availability;
  }

  function buildWhere(filters, includeLocation) {
    const params = [];
    const where = [];
    const requestedMethod = filters.method || 'Sweet Scent';
    const selectedMethod = requestedMethod === 'All' || ENCOUNTER_METHODS[requestedMethod]
      ? requestedMethod : 'Sweet Scent';
    if (selectedMethod !== 'Sweet Scent') {
      const methods = selectedMethod === 'All'
        ? Object.values(ENCOUNTER_METHODS).flat()
        : ENCOUNTER_METHODS[selectedMethod];
      const methodParams = methods.map((method) => bind(params, method));
      where.push(`hs.method IN (${methodParams.join(', ')})`);
    }
    where.push(selectedMethod === 'Sweet Scent' ? 'hs.horde_size > 0' : selectedMethod === 'All' ? '1=1' : 'hs.horde_size = 0');
    if (filters.season) {
      const season = bind(params, filters.season);
      where.push(`hs.season IN (${season}, 'Any')`);
    }
    if (filters.time) {
      const time = bind(params, filters.time);
      where.push(`(hs.time = ${time} OR hs.time = 'Any')`);
    }
    if (filters.region) where.push(`hs.region = ${bind(params, filters.region)}`);
    if (filters.hordeSize && ['All', 'Sweet Scent'].includes(selectedMethod)) {
      where.push(`hs.horde_size = ${bind(params, Number(filters.hordeSize))}`);
    }
    if (filters.nonSafari && ['All', 'Singles', 'Fishing'].includes(selectedMethod)) {
      where.push("LOWER(hs.location) NOT LIKE '%safari%' AND LOWER(hs.location) NOT LIKE '%great marsh%'");
    }
    if (includeLocation && filters.location) {
      where.push(`LOWER(hs.location) LIKE ${bind(params, `%${String(filters.location).toLowerCase()}%`)}`);
    }
    if (filters.species) {
      const species = bind(params, `%${String(filters.species).toLowerCase()}%`);
      where.push(`EXISTS (SELECT 1 FROM hunt_spot_species hss WHERE hss.spot_key = hs.spot_key AND LOWER(hss.name) LIKE ${species})`);
    }
    const minTier = Number(filters.minTier);
    if (Number.isInteger(minTier) && minTier >= 0 && minTier <= 7) {
      where.push(`EXISTS (SELECT 1 FROM hunt_spot_species hss WHERE hss.spot_key = hs.spot_key AND hss.tier_number <= ${bind(params, minTier)})`);
    }
    const minLevel = Math.max(0, Number(filters.minLevel) || 0);
    if (minLevel) {
      where.push(`NOT EXISTS (SELECT 1 FROM hunt_spot_species hss WHERE hss.spot_key = hs.spot_key AND hss.min_level < ${bind(params, minLevel)})`);
    }
    if (filters.fullSplitOnly && ['All', 'Sweet Scent'].includes(selectedMethod)) {
      where.push('hs.horde_size > 0 AND EXISTS (SELECT 1 FROM hunt_spot_species hss WHERE hss.spot_key = hs.spot_key AND hss.split = 1)');
    }
    const evColumns = (filters.evStats || []).map((stat) => EV_COLUMNS[stat]).filter(Boolean);
    const evAmount = [1, 2].includes(Number(filters.evAmounts?.[0])) ? Number(filters.evAmounts[0]) : null;
    if (evColumns.length) {
      const matches = evColumns.map((column) => evAmount ? `hss.${column} = ${evAmount}` : `hss.${column} > 0`).join(' OR ');
      where.push(`${filters.exclusiveEvYield ? 'NOT EXISTS' : 'EXISTS'} (SELECT 1 FROM hunt_spot_species hss WHERE hss.spot_key = hs.spot_key AND ${filters.exclusiveEvYield ? `NOT (${matches})` : `(${matches})`})`);
    }
    if (filters.eggGroups?.length) {
      const groups = filters.eggGroups.map((group) => bind(params, String(group).toLowerCase()));
      where.push(`EXISTS (SELECT 1 FROM hunt_spot_egg_groups hseg WHERE hseg.spot_key = hs.spot_key AND hseg.egg_group IN (${groups.join(', ')}))`);
    }
    const denominator = effectiveShinyDenominator(filters.profile);
    const pointScale = effectiveShinyDenominator({}) / denominator;
    if (Number(filters.minPointsPerHour) > 0 && !['Headbutt', 'Rock Smash'].includes(selectedMethod)) {
      where.push(`hs.points_per_hour * ${pointScale} >= ${bind(params, Number(filters.minPointsPerHour))}`);
    }
    const expScale = 1 + ([0.25, 0.5, 1].includes(Number(filters.expCharm)) ? Number(filters.expCharm) : 0)
      + (filters.expReamplifier ? 0.05 : 0) + (filters.expDonator ? 0.25 : 0) + (filters.tradeBonus ? 0.15 : 0);
    if (Number(filters.minExpPerHour) > 0 && !['Headbutt', 'Rock Smash'].includes(selectedMethod)) {
      where.push(`hs.exp_per_hour * ${expScale} >= ${bind(params, Number(filters.minExpPerHour))}`);
    }
    return { params, selectedMethod, sql: where.join(' AND '), pointScale, expScale };
  }

  function orderBy(filters, selectedMethod) {
    const direction = filters.sortDirection === 'desc' ? 'DESC' : 'ASC';
    if ((filters.sort || 'pointsPerHour') === 'alphabetical') return `hs.location ${direction}, hs.region ASC, hs.spot_key ASC`;
    if (filters.sort === 'averagePoints' || ['Headbutt', 'Rock Smash'].includes(selectedMethod)) return `hs.average_points ${direction}, hs.location ASC`;
    const field = filters.sort === 'expPerHour' ? 'hs.exp_per_hour' : 'hs.points_per_hour';
    return `(${field} IS NULL) ASC, ${field} ${direction}, hs.location ASC`;
  }

  function applyRuntimeMetrics(spot, filters) {
    const denominator = effectiveShinyDenominator(filters.profile);
    const encountersPerHour = encounterRatePerHour({ method: spot.method, horde_size: spot.horde_size }, filters);
    const metrics = calculateHordeMetrics(spot.composition, { hordesPerHour: encountersPerHour || 0, denominator, hordeSize: 1 });
    const special = spot.composition.filter((species) => species.is_special);
    const averagePoints = special.length === spot.composition.length
      ? special.reduce((sum, species) => sum + Number(species.points || 0), 0) / special.length
      : metrics.averagePoints;
    return {
      ...spot, denominator, ...metrics,
      ...calculateExperienceMetrics(metrics.composition, encountersPerHour, filters.expCharm, filters),
      averagePoints, encountersPerHour,
      pointsPerHour: encountersPerHour === null ? null : metrics.pointsPerHour,
    };
  }

  async function list(filters = {}) {
    const hasUserSpecificScoring = ['officialUniqueBonus', 'teamUniqueBonus', 'excludeOfficialCaught', 'excludeTeamCaught']
      .some((key) => filters[key]) || ['officialCaughtFamilyKeys', 'teamCaughtFamilyKeys', 'playerCaughtFamilyKeys']
      .some((key) => filters[key]?.length);
    if (hasUserSpecificScoring || filters.encountersPerHour || filters.chumBucket || !(await isAvailable())) return null;
    const locationsQuery = buildWhere(filters, false);
    const locationsRows = await runSelect(`SELECT DISTINCT hs.location FROM hunt_spots hs WHERE ${locationsQuery.sql} ORDER BY hs.location`, locationsQuery.params, 'huntFinder.locations');
    const query = buildWhere(filters, true);
    const totalRow = await runOne(`SELECT COUNT(*) AS count FROM hunt_spots hs WHERE ${query.sql}`, query.params);
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(1000, Math.max(1, Number(filters.pageSize) || 30));
    const rows = await runSelect(`SELECT hs.spot_json FROM hunt_spots hs WHERE ${query.sql}
      ORDER BY ${orderBy(filters, query.selectedMethod)} LIMIT ${bind(query.params, pageSize)} OFFSET ${bind(query.params, (page - 1) * pageSize)}`,
    query.params, 'huntFinder.page');
    return {
      items: rows.map((row) => applyRuntimeMetrics(JSON.parse(row.spot_json), filters)),
      total: Number(totalRow?.count) || 0,
      page,
      pageSize,
      locations: [...new Set(locationsRows.map((row) => parentLocationName(row.location)))].sort((a, b) => a.localeCompare(b)),
    };
  }

  return { list };
}

module.exports = { createMaterializedHuntFinder };
