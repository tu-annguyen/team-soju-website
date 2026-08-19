const crypto = globalThis.crypto || require('crypto');
const {
  SHINY_WAR_2026,
  calculateHordeMetrics,
  effectiveShinyDenominator,
  getPokemonTier,
  getShinyWarSeason,
  scoreShinyWarCatches,
  TIER_POINTS,
} = require('@team-soju/utils');
const { groupEquivalentHuntSpots, parentLocationName } = require('./hunt-spot-groups');

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

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

  // Migration 0002 converted every null-rate row to a lure. In the source data,
  // real lures are Any-season records; Unova's seasonal null-rate records are
  // phenomena. The remaining Any-season exceptions are identifiable directly.
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

function createShinyWarRepository({ dialect, parameter, runCommand, runOne, runSelect }) {
  const nowExpression = dialect === 'd1' ? "datetime('now')" : 'now()';

  async function getEvent(eventId = '2026') {
    const row = await runOne(
      `SELECT * FROM shiny_war_events WHERE id = ${parameter(1)}`,
      [eventId]
    );
    if (!row) return null;
    return {
      ...row,
      roster_locked: Boolean(row.roster_locked),
      seasons: parseJson(row.seasons_json, SHINY_WAR_2026.seasons),
    };
  }

  async function listParticipants(eventId = '2026') {
    const rows = await runSelect(`
      SELECT p.event_id, p.member_id, p.team, p.is_official, p.created_at,
             m.ign, m.rank, m.discord_id,
             CASE WHEN u.id IS NULL THEN 0 ELSE 1 END AS has_app_user
      FROM shiny_war_participants p
      JOIN team_members m ON m.id = p.member_id
      LEFT JOIN app_users u ON u.discord_id = m.discord_id
      WHERE p.event_id = ${parameter(1)}
      ORDER BY LOWER(m.ign)
    `, [eventId]);
    return rows.map((row) => ({
      ...row,
      has_app_user: Boolean(row.has_app_user),
      is_official: Boolean(row.is_official),
    }));
  }

  async function addParticipant(eventId, memberId, userId, team, isOfficial) {
    const insert = dialect === 'd1' ? 'INSERT OR IGNORE' : 'INSERT';
    const conflict = dialect === 'postgres' ? ' ON CONFLICT (event_id, member_id) DO NOTHING' : '';
    await runCommand(`${insert} INTO shiny_war_participants
      (event_id, member_id, added_by_user_id, team, is_official)
      VALUES (${parameter(1)}, ${parameter(2)}, ${parameter(3)}, ${parameter(4)}, ${parameter(5)})${conflict}`,
    [eventId, memberId, userId, team, dialect === 'd1' ? (isOfficial ? 1 : 0) : isOfficial]);
    return listParticipants(eventId);
  }

  async function updateParticipant(eventId, memberId, team, isOfficial) {
    await runCommand(`UPDATE shiny_war_participants
      SET team = ${parameter(3)}, is_official = ${parameter(4)}
      WHERE event_id = ${parameter(1)} AND member_id = ${parameter(2)}`,
    [eventId, memberId, team, dialect === 'd1' ? (isOfficial ? 1 : 0) : isOfficial]);
    return listParticipants(eventId);
  }

  async function removeParticipant(eventId, memberId) {
    await runCommand(`DELETE FROM shiny_war_participants
      WHERE event_id = ${parameter(1)} AND member_id = ${parameter(2)}`,
    [eventId, memberId]);
    return listParticipants(eventId);
  }

  async function setRosterLocked(eventId, locked) {
    await runCommand(`UPDATE shiny_war_events
      SET roster_locked = ${parameter(2)}, updated_at = ${nowExpression}
      WHERE id = ${parameter(1)}`, [eventId, locked ? 1 : 0]);
    return getEvent(eventId);
  }

  async function listHunts(eventId = '2026') {
    const participants = await listParticipants(eventId);
    const rows = await runSelect(`
      SELECT h.*, m.ign
      FROM shiny_war_hunts h
      JOIN team_members m ON m.id = h.member_id
      WHERE h.event_id = ${parameter(1)}
      ORDER BY LOWER(m.ign), h.position
    `, [eventId]);
    const hunts = rows.map((row) => ({ ...row, details: parseJson(row.details_json, {}) }));
    const occupied = new Map();
    for (const hunt of hunts.filter((entry) => entry.position === 0)) {
      for (const key of [hunt.spot_key, hunt.target_family_key].filter(Boolean)) {
        occupied.set(key, [...(occupied.get(key) || []), hunt.member_id]);
      }
    }
    return participants.map((participant) => ({
      ...participant,
      hunts: hunts.filter((hunt) => hunt.member_id === participant.member_id).map((hunt) => ({
        ...hunt,
        overlap_member_ids: [...new Set([
          ...(occupied.get(hunt.spot_key) || []),
          ...(occupied.get(hunt.target_family_key) || []),
        ])].filter((id) => id !== hunt.member_id),
      })),
    }));
  }

  async function replaceQueue(eventId, memberId, queue) {
    await runCommand(`DELETE FROM shiny_war_hunts
      WHERE event_id = ${parameter(1)} AND member_id = ${parameter(2)}`,
    [eventId, memberId]);
    for (const [position, item] of queue.entries()) {
      await runCommand(`INSERT INTO shiny_war_hunts
        (id, event_id, member_id, position, spot_key, target_family_key, label, details_json)
        VALUES (${parameter(1)}, ${parameter(2)}, ${parameter(3)}, ${parameter(4)},
          ${parameter(5)}, ${parameter(6)}, ${parameter(7)}, ${parameter(8)})`,
      [
        crypto.randomUUID(), eventId, memberId, position, item.spot_key,
        item.target_family_key || null, item.label, JSON.stringify(item.details || {}),
      ]);
    }
    return listHunts(eventId);
  }

  async function listHordeSpots(filters = {}) {
    const params = [];
    const where = [];
    const requestedMethod = filters.method || 'Sweet Scent';
    const selectedMethod = requestedMethod === 'All' || ENCOUNTER_METHODS[requestedMethod]
      ? requestedMethod
      : 'Sweet Scent';
    const officialCaughtFamilyKeys = new Set(
      (filters.officialCaughtFamilyKeys || []).map(normalizeFamilyKey)
    );
    const teamCaughtFamilyKeys = new Set(
      (filters.teamCaughtFamilyKeys || []).map(normalizeFamilyKey)
    );
    const playerCaughtFamilyKeys = new Set(
      (filters.playerCaughtFamilyKeys || []).map(normalizeFamilyKey)
    );
    const bonusCaughtFamilyKeys = new Set(
      ((filters.teamUniqueBonus
        ? filters.teamCaughtFamilyKeys
        : filters.officialCaughtFamilyKeys) || []).map(normalizeFamilyKey)
    );
    const applyUniqueBonus = Boolean(filters.officialUniqueBonus || filters.teamUniqueBonus);
    const addFilter = (column, value) => {
      if (!value) return;
      params.push(value);
      where.push(`${column} = ${parameter(params.length)}`);
    };
    if (filters.season) {
      params.push(filters.season);
      where.push(`(e.season = ${parameter(params.length)} OR e.season = 'Any')`);
    }
    addFilter('l.region', filters.region);
    if (selectedMethod === 'Sweet Scent') {
      where.push('e.horde_size > 0');
    } else {
      const methods = selectedMethod === 'All'
        ? Object.values(ENCOUNTER_METHODS).flat()
        : ENCOUNTER_METHODS[selectedMethod];
      const placeholders = methods.map((method) => {
        params.push(method);
        return parameter(params.length);
      });
      where.push(`e.method IN (${placeholders.join(', ')})`);
      if (selectedMethod !== 'All') where.push('e.horde_size = 0');
    }
    if (['All', 'Sweet Scent'].includes(selectedMethod) && filters.hordeSize) {
      addFilter('e.horde_size', Number(filters.hordeSize));
    }
    if (filters.nonSafari && ['All', 'Singles', 'Fishing'].includes(selectedMethod)) {
      where.push("LOWER(l.name) NOT LIKE '%safari%' AND LOWER(l.name) NOT LIKE '%great marsh%'");
    }
    const minTier = Number(filters.minTier);
    if (filters.minTier !== undefined && Number.isInteger(minTier) && minTier >= 0 && minTier <= 7) {
      params.push(minTier);
      where.push(`CASE s.tier
        WHEN 'Tier 0' THEN 0 WHEN 'Tier 1' THEN 1 WHEN 'Tier 2' THEN 2
        WHEN 'Tier 3' THEN 3 WHEN 'Tier 4' THEN 4 WHEN 'Tier 5' THEN 5
        WHEN 'Tier 6' THEN 6 WHEN 'Tier 7' THEN 7
        ELSE NULL END <= ${parameter(params.length)}`);
    }
    const rows = await runSelect(`
      SELECT e.*, l.region, l.name AS location_name, s.name AS species_name,
             s.slug, s.family_key, s.tier, s.points
      FROM pokedex_encounters e
      JOIN pokedex_locations l ON l.id = e.location_id
      JOIN pokedex_species s ON s.id = e.species_id
      WHERE ${where.join(' AND ')}
      ORDER BY l.region, l.name, e.method, e.season, e.horde_size, s.name
    `, params);
    const times = filters.time ? [filters.time] : ['morning', 'day', 'night'];
    const groups = new Map();
    for (const row of rows) {
      const hasNoRecordedRates = ['morning', 'day', 'night'].every(
        (time) => row[`${time}_rate`] === null || row[`${time}_rate`] === undefined
      );
      const legacyLureEncounter = Number(row.horde_size) === 0 && hasNoRecordedRates;
      const isSpecialEncounter = isSpecialEncounterRow(row);
      const hasUnknownIllusionRate = Number(row.horde_size) > 0
        && row.slug === 'zorua'
        && hasNoRecordedRates;
      const seasons = row.season === 'Any'
        ? (filters.season ? [filters.season] : SHINY_WAR_2026.seasons)
        : [row.season];
      for (const season of seasons) {
        for (const time of times) {
          const rate = legacyLureEncounter && !isSpecialEncounter ? 5 : row[`${time}_rate`];
          if (!isSpecialEncounter && !hasUnknownIllusionRate
            && (rate === null || rate === undefined || Number(rate) <= 0)) continue;
          const key = [row.location_id, row.method, season, time, row.horde_size].join('|');
          if (!groups.has(key)) groups.set(key, { key, row: { ...row, season }, time, species: [] });
          groups.get(key).species.push({
            name: row.species_name, slug: row.slug, family_key: row.family_key,
            tier: row.tier, points: row.points,
            rate: isSpecialEncounter || hasUnknownIllusionRate ? 0 : Number(rate),
            rate_unknown: hasUnknownIllusionRate,
            is_lure: !isSpecialEncounter && Number(row.horde_size) === 0
              && (Boolean(row.is_lure) || legacyLureEncounter),
            is_special: isSpecialEncounter,
            form: row.form, min_level: row.min_level, max_level: row.max_level,
          });
        }
      }
    }
    const denominator = effectiveShinyDenominator(filters.profile);
    const spots = [...groups.values()].map(({ key, row, time, species }) => {
      const scoredSpecies = species.map((entry) => ({
        ...entry,
        points: playerCaughtFamilyKeys.has(normalizeFamilyKey(entry.family_key))
          ? 1
          : entry.points,
      }));
      const encountersPerHour = encounterRatePerHour(row, filters);
      const metrics = calculateHordeMetrics(scoredSpecies, {
        hordesPerHour: encountersPerHour || 0,
        denominator,
        hordeSize: 1,
      });
      const specialSpecies = scoredSpecies.filter((entry) => entry.is_special);
      const baseAveragePoints = specialSpecies.length === scoredSpecies.length
        ? specialSpecies.reduce((sum, entry) => sum + Number(entry.points || 0), 0) / specialSpecies.length
        : metrics.averagePoints;
      const uniqueBonus = applyUniqueBonus ? metrics.composition.reduce(
        (sum, entry) => bonusCaughtFamilyKeys.has(normalizeFamilyKey(entry.family_key))
          ? sum
          : sum + (8 * entry.split),
        0
      ) : 0;
      const averagePoints = baseAveragePoints + uniqueBonus;
      return {
        spot_key: key,
        region: row.region,
        location_id: row.location_id,
        location: row.location_name,
        method: row.method,
        season: row.season,
        time,
        horde_size: row.horde_size,
        is_lure: scoredSpecies.some((entry) => entry.is_lure),
        is_special: scoredSpecies.some((entry) => entry.is_special),
        denominator,
        ...metrics,
        averagePoints,
        encountersPerHour,
        pointsPerHour: encountersPerHour === null
          ? null
          : metrics.pointsPerHour + ((uniqueBonus * encountersPerHour) / denominator),
      };
    });
    const speciesFilter = String(filters.species || '').trim().toLowerCase();
    const excludedFamilyKeys = filters.excludeTeamCaught
      ? teamCaughtFamilyKeys
      : officialCaughtFamilyKeys;
    const caughtFilteredSpots = (filters.excludeOfficialCaught || filters.excludeTeamCaught)
      ? spots.filter((spot) => !spot.composition.some(
        (species) => excludedFamilyKeys.has(normalizeFamilyKey(species.family_key))
      ))
      : spots;
    const splitFilteredSpots = ['All', 'Sweet Scent'].includes(selectedMethod) && filters.fullSplitOnly
      ? caughtFilteredSpots.filter(
        (spot) => Number(spot.horde_size) > 0
          && spot.composition.some((species) => species.split === 1)
      )
      : caughtFilteredSpots;
    const matchingSpots = speciesFilter
      ? splitFilteredSpots.filter((spot) => spot.composition.some(
        (species) => species.name.toLowerCase().includes(speciesFilter)
      ))
      : splitFilteredSpots;
    const locations = [...new Set(matchingSpots.map((spot) => parentLocationName(spot.location)))]
      .sort((left, right) => left.localeCompare(right));
    const locationFilter = String(filters.location || '').trim().toLowerCase();
    const locationFilteredSpots = locationFilter
      ? matchingSpots.filter((spot) => parentLocationName(spot.location).toLowerCase().includes(locationFilter))
      : matchingSpots;
    const minimumPointsPerHour = Math.max(0, Number(filters.minPointsPerHour) || 0);
    const hasHourlyData = !['Headbutt', 'Rock Smash'].includes(selectedMethod);
    const pointsFilteredSpots = minimumPointsPerHour && hasHourlyData
      ? locationFilteredSpots.filter(
        (spot) => spot.pointsPerHour !== null && spot.pointsPerHour >= minimumPointsPerHour
      )
      : locationFilteredSpots;
    const groupedSpots = groupEquivalentHuntSpots(pointsFilteredSpots);
    const sortByAverage = filters.sort === 'averagePoints' || !hasHourlyData;
    groupedSpots.sort((a, b) => {
      if (sortByAverage) return b.averagePoints - a.averagePoints || a.location.localeCompare(b.location);
      if (a.pointsPerHour === null) return b.pointsPerHour === null
        ? b.averagePoints - a.averagePoints || a.location.localeCompare(b.location)
        : 1;
      if (b.pointsPerHour === null) return -1;
      return b.pointsPerHour - a.pointsPerHour || a.location.localeCompare(b.location);
    });
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(1000, Math.max(1, Number(filters.pageSize) || 30));
    return {
      items: groupedSpots.slice((page - 1) * pageSize, page * pageSize),
      total: groupedSpots.length,
      page,
      pageSize,
      locations,
    };
  }

  async function listEncounters(filters = {}) {
    const params = [];
    const where = [];
    const addFilter = (column, value) => {
      if (!value) return;
      params.push(value);
      where.push(`${column} = ${parameter(params.length)}`);
    };
    addFilter('e.season', filters.season);
    addFilter('l.region', filters.region);
    addFilter('e.method', filters.method);
    addFilter('e.horde_size', filters.hordeSize ? Number(filters.hordeSize) : undefined);
    if (filters.species) {
      params.push(`%${String(filters.species).toLowerCase()}%`);
      where.push(`LOWER(s.name) LIKE ${parameter(params.length)}`);
    }
    const rows = await runSelect(`
      SELECT e.*, l.region, l.name AS location, s.name AS species,
             s.slug, s.family_key, s.tier, s.points
      FROM pokedex_encounters e
      JOIN pokedex_locations l ON l.id = e.location_id
      JOIN pokedex_species s ON s.id = e.species_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY l.region, l.name, e.method, e.season, s.name
    `, params);
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 50));
    return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
  }

  async function getDashboard(eventId = '2026', at = new Date()) {
    const [event, participants] = await Promise.all([getEvent(eventId), listParticipants(eventId)]);
    if (!event) return null;
    const rows = await runSelect(`
      SELECT ts.*, ps.family_key, ps.tier, ps.points AS tier_points, tm.ign
      FROM team_shinies ts
      JOIN team_members tm ON tm.id = ts.original_trainer
      LEFT JOIN pokedex_species ps
        ON ps.slug = LOWER(REPLACE(REPLACE(ts.pokemon, ' ', '-'), '.', ''))
      WHERE ts.original_trainer IN (
        SELECT member_id FROM shiny_war_participants WHERE event_id = ${parameter(1)}
      )
    `, [eventId]);
    const catches = rows.map((row) => {
      const tier = row.tier || getPokemonTier(row.pokemon);
      return { ...row, tier, tier_points: row.tier_points || TIER_POINTS[tier] || 0 };
    });
    const scoringEvent = {
      id: event.id, startsAt: event.starts_at, endsAt: event.ends_at,
      seasons: event.seasons, seasonDays: event.season_days,
    };
    const officialParticipants = participants.filter((participant) => participant.is_official);
    const officialScoring = scoreShinyWarCatches(
      catches,
      officialParticipants.map((participant) => participant.member_id),
      scoringEvent
    );
    const teamScoring = Object.fromEntries(['bidoof', 'arceus'].map((team) => [
      team,
      scoreShinyWarCatches(
        catches,
        participants.filter((participant) => participant.team === team).map((participant) => participant.member_id),
        scoringEvent
      ),
    ]));
    const participantById = new Map(participants.map((participant) => [participant.member_id, participant]));
    const startsAt = new Date(scoringEvent.startsAt).getTime();
    const endsAt = new Date(scoringEvent.endsAt).getTime();
    const eventCatches = catches
      .filter((entry) => {
        const caughtAt = new Date(entry.caught_at_utc).getTime();
        return caughtAt >= startsAt && caughtAt < endsAt;
      })
      .sort((left, right) => String(right.caught_at_utc).localeCompare(String(left.caught_at_utc)));
    const recentCatchesFor = (allowedParticipants, scoredCatches) => {
      const allowedIds = new Set(allowedParticipants.map((participant) => participant.member_id));
      const scoredById = new Map(scoredCatches.map((entry) => [entry.id, entry]));
      return eventCatches.filter((entry) => allowedIds.has(entry.original_trainer)).slice(0, 30).map((entry) => {
        const participant = participantById.get(entry.original_trainer);
        return {
          ...(scoredById.get(entry.id) || {
            ...entry,
            score: { base: 0, secretBonus: 0, safariBonus: 0, uniqueBonus: 0, total: 0 },
          }),
          member_id: entry.original_trainer,
          team: participant?.team,
          is_official: Boolean(participant?.is_official),
        };
      });
    };
    const standingsFor = (scoring, selectedParticipants) => selectedParticipants.map((participant) => {
      const participantCatches = scoring.catches
        .filter((entry) => entry.original_trainer === participant.member_id);
      const basePoints = participantCatches
        .reduce((sum, entry) => sum + entry.score.base, 0);
      const bonusPoints = participantCatches.reduce(
        (sum, entry) => sum + entry.score.secretBonus + entry.score.safariBonus + entry.score.uniqueBonus,
        0
      );
      return {
        ...participant,
        points: basePoints + bonusPoints,
        basePoints,
        bonusPoints,
        catches: participantCatches.length,
        caughtFamilyKeys: [...new Set(participantCatches.map((entry) => entry.family_key))],
      };
    }).sort((a, b) => b.points - a.points || a.ign.localeCompare(b.ign));
    const teamCatches = Object.values(teamScoring).flatMap((scoring) => scoring.catches);
    return {
      event,
      currentSeason: getShinyWarSeason(at, scoringEvent),
      officialWar: {
        teamTotal: officialScoring.teamTotal,
        uniqueFamilyCount: officialScoring.uniqueFamilies.length,
        uniqueFamilies: officialScoring.uniqueFamilies,
        standings: standingsFor(officialScoring, officialParticipants),
        recentCatches: recentCatchesFor(officialParticipants, officialScoring.catches),
      },
      teamWar: {
        teamTotals: {
          bidoof: teamScoring.bidoof.teamTotal,
          arceus: teamScoring.arceus.teamTotal,
        },
        uniqueFamilies: {
          bidoof: teamScoring.bidoof.uniqueFamilies,
          arceus: teamScoring.arceus.uniqueFamilies,
        },
        standings: participants.flatMap((participant) => standingsFor(
          teamScoring[participant.team], [participant]
        )).sort((a, b) => b.points - a.points || a.ign.localeCompare(b.ign)),
        recentCatches: recentCatchesFor(participants, teamCatches),
      },
    };
  }

  async function setEligibility(shinyId, eligible) {
    await runCommand(`UPDATE team_shinies SET war_eligibility_override = ${parameter(2)}
      WHERE id = ${parameter(1)}`, [shinyId, eligible]);
    return runOne(`SELECT * FROM team_shinies WHERE id = ${parameter(1)}`, [shinyId]);
  }

  return {
    addParticipant, getDashboard, getEvent, listEncounters, listHordeSpots, listHunts,
    listParticipants, removeParticipant, replaceQueue, setEligibility, setRosterLocked, updateParticipant,
  };
}

module.exports = { createShinyWarRepository };
