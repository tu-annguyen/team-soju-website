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

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
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
      SELECT p.event_id, p.member_id, p.created_at, m.ign, m.rank, m.discord_id,
             CASE WHEN u.id IS NULL THEN 0 ELSE 1 END AS has_app_user
      FROM shiny_war_participants p
      JOIN team_members m ON m.id = p.member_id
      LEFT JOIN app_users u ON u.discord_id = m.discord_id
      WHERE p.event_id = ${parameter(1)}
      ORDER BY LOWER(m.ign)
    `, [eventId]);
    return rows.map((row) => ({ ...row, has_app_user: Boolean(row.has_app_user) }));
  }

  async function addParticipant(eventId, memberId, userId) {
    const insert = dialect === 'd1' ? 'INSERT OR IGNORE' : 'INSERT';
    const conflict = dialect === 'postgres' ? ' ON CONFLICT (event_id, member_id) DO NOTHING' : '';
    await runCommand(`${insert} INTO shiny_war_participants
      (event_id, member_id, added_by_user_id)
      VALUES (${parameter(1)}, ${parameter(2)}, ${parameter(3)})${conflict}`,
    [eventId, memberId, userId]);
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
    const where = ['e.horde_size > 0'];
    const addFilter = (column, value) => {
      if (!value) return;
      params.push(value);
      where.push(`${column} = ${parameter(params.length)}`);
    };
    addFilter('e.season', filters.season);
    addFilter('l.region', filters.region);
    addFilter('e.method', filters.method);
    if (filters.hordeSize) addFilter('e.horde_size', Number(filters.hordeSize));
    if (filters.tier) addFilter('s.tier', filters.tier);
    if (filters.species) {
      params.push(`%${filters.species.toLowerCase()}%`);
      where.push(`LOWER(s.name) LIKE ${parameter(params.length)}`);
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
      for (const time of times) {
        const rate = row[`${time}_rate`];
        if (rate === null || rate === undefined || Number(rate) <= 0) continue;
        const key = [row.location_id, row.method, row.season, time, row.horde_size].join('|');
        if (!groups.has(key)) groups.set(key, { key, row, time, species: [] });
        groups.get(key).species.push({
          name: row.species_name, slug: row.slug, family_key: row.family_key,
          tier: row.tier, points: row.points, rate: Number(rate),
          form: row.form, min_level: row.min_level, max_level: row.max_level,
        });
      }
    }
    const denominator = effectiveShinyDenominator(filters.profile);
    const spots = [...groups.values()].map(({ key, row, time, species }) => ({
      spot_key: key,
      region: row.region,
      location_id: row.location_id,
      location: row.location_name,
      method: row.method,
      season: row.season,
      time,
      horde_size: row.horde_size,
      denominator,
      ...calculateHordeMetrics(species, {
        hordesPerHour: filters.hordesPerHour || 240,
        denominator,
        hordeSize: row.horde_size,
      }),
    }));
    const sort = filters.sort === 'averagePoints' ? 'averagePoints' : 'pointsPerHour';
    spots.sort((a, b) => b[sort] - a[sort] || a.location.localeCompare(b.location));
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 30));
    return { items: spots.slice((page - 1) * pageSize, page * pageSize), total: spots.length, page, pageSize };
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
    const scoring = scoreShinyWarCatches(catches, participants.map((p) => p.member_id), scoringEvent);
    const scoredById = new Map(scoring.catches.map((entry) => [entry.id, entry]));
    const startsAt = new Date(scoringEvent.startsAt).getTime();
    const endsAt = new Date(scoringEvent.endsAt).getTime();
    const recentCatches = catches
      .filter((entry) => {
        const caughtAt = new Date(entry.caught_at_utc).getTime();
        return caughtAt >= startsAt && caughtAt < endsAt;
      })
      .sort((left, right) => String(right.caught_at_utc).localeCompare(String(left.caught_at_utc)))
      .slice(0, 30)
      .map((entry) => scoredById.get(entry.id) || {
        ...entry,
        score: { base: 0, secretBonus: 0, safariBonus: 0, uniqueBonus: 0, total: 0 },
      });
    return {
      event,
      currentSeason: getShinyWarSeason(at, scoringEvent),
      teamTotal: scoring.teamTotal,
      uniqueFamilyCount: scoring.uniqueFamilies.length,
      uniqueFamilies: scoring.uniqueFamilies,
      standings: participants.map((participant) => ({
        ...participant,
        points: scoring.participantTotals[participant.member_id] || 0,
        catches: scoring.catches.filter((entry) => entry.original_trainer === participant.member_id).length,
      })).sort((a, b) => b.points - a.points || a.ign.localeCompare(b.ign)),
      recentCatches,
    };
  }

  async function setEligibility(shinyId, eligible) {
    await runCommand(`UPDATE team_shinies SET war_eligibility_override = ${parameter(2)}
      WHERE id = ${parameter(1)}`, [shinyId, eligible]);
    return runOne(`SELECT * FROM team_shinies WHERE id = ${parameter(1)}`, [shinyId]);
  }

  return {
    addParticipant, getDashboard, getEvent, listEncounters, listHordeSpots, listHunts,
    listParticipants, removeParticipant, replaceQueue, setEligibility, setRosterLocked,
  };
}

module.exports = { createShinyWarRepository };
