const {
  SHINY_WAR_2026,
  calculateHordeMetrics,
  effectiveShinyDenominator,
} = require('@team-soju/utils');
const { groupEquivalentHuntSpots } = require('../cloudflare/repositories/hunt-spot-groups');
const {
  calculateExperienceMetrics,
  encounterRatePerHour,
} = require('../cloudflare/repositories/hunt-finder');

function tierNumber(tier) {
  const match = String(tier || '').match(/^Tier ([0-7])$/);
  return match ? Number(match[1]) : null;
}

function materializeHuntSpots(data) {
  const speciesById = new Map(data.species.map((species) => [species.id, species]));
  const locationsById = new Map(data.locations.map((location) => [location.id, location]));
  const groups = new Map();

  data.encounters.forEach((encounter) => {
    const species = speciesById.get(encounter.speciesId);
    const location = locationsById.get(encounter.locationId);
    if (!species || !location) return;
    const rates = {
      morning: encounter.morningRate,
      day: encounter.dayRate,
      night: encounter.nightRate,
    };
    const unknownIllusionRate = encounter.hordeSize > 0
      && species.slug === 'zorua'
      && Object.values(rates).every((rate) => rate === null);
    const seasons = encounter.season === 'Any' ? SHINY_WAR_2026.seasons : [encounter.season];
    seasons.forEach((season) => Object.entries(rates).forEach(([time, recordedRate]) => {
      const rate = encounter.isLure && recordedRate === null ? 5 : recordedRate;
      if (!encounter.isSpecial && !unknownIllusionRate && !(Number(rate) > 0)) return;
      const key = [encounter.locationId, encounter.method, season, time, encounter.hordeSize].join('|');
      if (!groups.has(key)) groups.set(key, {
        key,
        location,
        method: encounter.method,
        season,
        time,
        hordeSize: encounter.hordeSize,
        species: [],
      });
      groups.get(key).species.push({
        species_id: species.id,
        name: species.name,
        slug: species.slug,
        family_key: species.familyKey,
        tier: species.tier,
        tier_number: tierNumber(species.tier),
        points: species.points,
        rate: encounter.isSpecial || unknownIllusionRate ? 0 : Number(rate),
        rate_unknown: unknownIllusionRate,
        is_lure: encounter.isLure,
        is_special: encounter.isSpecial,
        form: encounter.form,
        min_level: encounter.minLevel,
        max_level: encounter.maxLevel,
        base_exp: species.baseExp,
        ev_hp: species.evHp,
        ev_attack: species.evAttack,
        ev_defense: species.evDefense,
        ev_sp_attack: species.evSpAttack,
        ev_sp_defense: species.evSpDefense,
        ev_speed: species.evSpeed,
        egg_groups: species.eggGroups,
      });
    }));
  });

  const denominator = effectiveShinyDenominator({});
  const rawSpots = [...groups.values()].map((group) => {
    const row = { method: group.method, horde_size: group.hordeSize };
    const encountersPerHour = encounterRatePerHour(row, {});
    const metrics = calculateHordeMetrics(group.species, {
      hordesPerHour: encountersPerHour || 0,
      denominator,
      hordeSize: 1,
    });
    const special = group.species.filter((species) => species.is_special);
    const averagePoints = special.length === group.species.length
      ? special.reduce((sum, species) => sum + Number(species.points || 0), 0) / special.length
      : metrics.averagePoints;
    return {
      spot_key: group.key,
      region: group.location.region,
      location_id: group.location.id,
      location: group.location.name,
      method: group.method,
      season: group.season,
      time: group.time,
      horde_size: group.hordeSize,
      is_lure: group.species.some((species) => species.is_lure),
      is_special: group.species.some((species) => species.is_special),
      denominator,
      ...metrics,
      ...calculateExperienceMetrics(metrics.composition, encountersPerHour, 0),
      averagePoints,
      encountersPerHour,
      pointsPerHour: encountersPerHour === null ? null : metrics.pointsPerHour,
    };
  });

  return groupEquivalentHuntSpots(rawSpots);
}

module.exports = { materializeHuntSpots, tierNumber };
