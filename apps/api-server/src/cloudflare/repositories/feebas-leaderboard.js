const {
  FEEBAS_VOTABLE_STATUSES,
  getLeaderboardLocationIds,
} = require('../../utils/feebas');

const LEADERBOARD_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const LEADERBOARD_REFRESH_LEASE_MS = 2 * 60 * 1000;
const SNAPSHOT_READ_CACHE_MS = 60 * 1000;
const ACCOUNT_FINGERPRINT_PREFIX = 'account-';
const LEADERBOARD_SORT_OPTIONS = [
  { key: 'ign', defaultDirection: 'asc' },
  { key: 'weeklyContributionScore', defaultDirection: 'desc' },
  { key: 'allTimeContributionScore', defaultDirection: 'desc' },
  { key: 'verifiedDiscoveries', defaultDirection: 'desc' },
  { key: 'feebasUptimeCreatedMinutes', defaultDirection: 'desc' },
  { key: 'confirmations', defaultDirection: 'desc' },
  { key: 'searchCoverage', defaultDirection: 'desc' },
  { key: 'reportAccuracy', defaultDirection: 'desc' },
  { key: 'efficiency', defaultDirection: 'desc' },
  { key: 'currentStreak', defaultDirection: 'desc' },
];
const SORT_KEYS = new Set(LEADERBOARD_SORT_OPTIONS.map(({ key }) => key));

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const time = (value) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
const cycleKey = (row) => String(row.cycleStart || row.cycle_start || row.cycleId || row.cycle_id);
const activityKey = (row) => `${row.location}:${row.cycleId}:${row.tileId}`;
const compareActivity = (left, right) => time(left.createdAt) - time(right.createdAt) || number(left.id) - number(right.id);

function add(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function minimum(map, key, value) {
  if (!map.has(key) || value < map.get(key)) map.set(key, value);
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 50) : 10;
}

function normalizeSort(sortBy, sortDirection) {
  return {
    sortBy: SORT_KEYS.has(sortBy) ? sortBy : 'rank',
    sortDirection: ['asc', 'desc'].includes(sortDirection) ? sortDirection : 'asc',
  };
}

function defaultCompare(left, right) {
  return number(right.allTimeContributionScore) - number(left.allTimeContributionScore)
    || number(right.verifiedDiscoveries) - number(left.verifiedDiscoveries)
    || number(right.feebasUptimeCreatedMinutes) - number(left.feebasUptimeCreatedMinutes)
    || number(right.confirmations) - number(left.confirmations)
    || number(right.searchCoverage) - number(left.searchCoverage)
    || left.ign.localeCompare(right.ign);
}

function rankEntries(entries, sortBy, sortDirection) {
  const multiplier = sortDirection === 'desc' ? -1 : 1;
  return [...entries].sort((left, right) => {
    const compared = sortBy === 'rank'
      ? defaultCompare(left, right)
      : sortBy === 'ign'
        ? left.ign.localeCompare(right.ign)
        : number(left[sortBy]) - number(right[sortBy]) || defaultCompare(left, right);
    return compared * multiplier;
  }).map((entry, index) => ({ rank: index + 1, ...entry }));
}

function responseFromSnapshot(location, snapshot, options) {
  const { sortBy, sortDirection } = normalizeSort(options.sortBy, options.sortDirection);
  const ranked = rankEntries(JSON.parse(snapshot.entries_json || '[]'), sortBy, sortDirection);
  const limit = normalizeLimit(options.limit);
  const entries = ranked.slice(0, limit);
  const current = options.currentUserId
    ? ranked.find(({ userId }) => String(userId) === String(options.currentUserId))
    : null;
  if (current && current.rank > limit) entries.push(current);
  return {
    location,
    generatedAt: snapshot.generated_at,
    weeklySince: snapshot.weekly_since,
    sort: { by: sortBy, direction: sortDirection },
    sortOptions: LEADERBOARD_SORT_OPTIONS.map((option) => ({ ...option })),
    entries,
  };
}

function buildStreaks(rows) {
  const orderedCycles = [];
  const seen = new Set();
  const userCycles = new Map();
  rows.forEach((row) => {
    const key = cycleKey(row);
    if (!seen.has(key)) { seen.add(key); orderedCycles.push(key); }
    const cycles = userCycles.get(String(row.user_id)) || new Set();
    cycles.add(key);
    userCycles.set(String(row.user_id), cycles);
  });
  return new Map([...userCycles].map(([userId, cycles]) => {
    let streak = 0;
    for (const key of orderedCycles) {
      if (!cycles.has(key)) break;
      streak += 1;
    }
    return [userId, streak];
  }));
}

function computeEntries(activityRows, users, weeklySince) {
  const weeklySinceMs = time(weeklySince);
  const usersByFingerprint = new Map(users.map((user) => [`${ACCOUNT_FINGERPRINT_PREFIX}${user.id}`, user]));
  const all = activityRows.map((row) => ({
    id: row.id, location: row.location, cycleId: String(row.cycle_id), cycle_id: row.cycle_id,
    tileId: row.tile_id, nextStatus: row.next_status, actorFingerprint: row.actor_fingerprint,
    createdAt: row.created_at, cycleStart: row.cycle_start, cycleEnd: row.cycle_end,
  }));
  const logged = all.flatMap((row) => {
    const user = usersByFingerprint.get(row.actorFingerprint);
    return user ? [{ ...row, userId: String(user.id), user_id: user.id, ign: user.ign }] : [];
  });
  const pendingByUserTile = new Map();
  const confirmedByTile = new Map();
  const activityByTile = new Map();
  for (const row of all) {
    const key = activityKey(row);
    const rows = activityByTile.get(key) || [];
    rows.push(row);
    activityByTile.set(key, rows);
    if (row.nextStatus === 'confirmed' && (!confirmedByTile.has(key) || compareActivity(row, confirmedByTile.get(key)) < 0)) {
      confirmedByTile.set(key, row);
    }
  }
  for (const row of logged) {
    if (row.nextStatus !== 'pending') continue;
    const key = `${activityKey(row)}:${row.userId}`;
    if (!pendingByUserTile.has(key) || compareActivity(row, pendingByUserTile.get(key)) < 0) pendingByUserTile.set(key, row);
  }
  const pending = [...pendingByUserTile.values()];
  const resolved = pending.flatMap((report) => {
    const resolution = (activityByTile.get(activityKey(report)) || []).find((row) => (
      time(row.createdAt) > time(report.createdAt) && ['checked', 'confirmed'].includes(row.nextStatus)
    ));
    return resolution ? [{ ...report, resolvedStatus: resolution.nextStatus }] : [];
  });
  const activeByCycle = new Map();
  logged.forEach((row) => {
    const usersInCycle = activeByCycle.get(cycleKey(row)) || new Set();
    usersInCycle.add(row.userId); activeByCycle.set(cycleKey(row), usersInCycle);
  });
  const firstPending = new Map();
  pending.forEach((row) => {
    const key = activityKey(row); const existing = firstPending.get(key);
    if (!existing || compareActivity(row, existing) < 0 || (compareActivity(row, existing) === 0 && row.userId < existing.userId)) firstPending.set(key, row);
  });
  const discoveries = [...firstPending.values()].flatMap((row) => confirmedByTile.has(activityKey(row)) ? [{
    ...row,
    uptimeMinutes: Math.max((time(row.cycleEnd) - time(row.createdAt)) / 60000, 0) * (activeByCycle.get(cycleKey(row))?.size || 1),
  }] : []);

  const maps = Object.fromEntries(['discoveries', 'uptime', 'weeklyDiscoveries', 'weeklyUptime', 'pending', 'verified', 'weeklyPending', 'weeklyVerified', 'fastest', 'persistent'].map((key) => [key, new Map()]));
  discoveries.forEach((row) => {
    add(maps.discoveries, row.userId); add(maps.uptime, row.userId, row.uptimeMinutes);
    minimum(maps.fastest, row.userId, Math.max((time(row.createdAt) - time(row.cycleStart)) / 1000, 0));
    if (time(row.createdAt) >= weeklySinceMs) { add(maps.weeklyDiscoveries, row.userId); add(maps.weeklyUptime, row.userId, row.uptimeMinutes); }
    const checks = new Set(logged.filter((entry) => entry.userId === row.userId && cycleKey(entry) === cycleKey(row)
      && time(entry.createdAt) <= time(row.createdAt) && ['checked', 'pending'].includes(entry.nextStatus)).map(({ tileId }) => tileId)).size;
    maps.persistent.set(row.userId, Math.max(checks, maps.persistent.get(row.userId) || 0));
  });
  resolved.forEach((row) => {
    add(maps.pending, row.userId); if (row.resolvedStatus === 'confirmed') add(maps.verified, row.userId);
    if (time(row.createdAt) >= weeklySinceMs) { add(maps.weeklyPending, row.userId); if (row.resolvedStatus === 'confirmed') add(maps.weeklyVerified, row.userId); }
  });
  const byUser = new Map();
  logged.forEach((row) => { if (!byUser.has(row.userId)) byUser.set(row.userId, { ign: row.ign, rows: [] }); byUser.get(row.userId).rows.push(row); });
  const streakRows = [...new Map(logged.map((row) => [`${row.userId}:${row.cycleId}`, { user_id: row.userId, cycle_id: row.cycle_id, cycle_start: row.cycleStart }])).values()]
    .sort((a, b) => time(b.cycle_start) - time(a.cycle_start) || number(b.cycle_id) - number(a.cycle_id));
  const streaks = buildStreaks(streakRows);
  return [...byUser].map(([userId, { ign, rows }]) => {
    const searchCoverage = new Set(rows.filter((r) => ['checked', 'pending'].includes(r.nextStatus)).map(activityKey)).size;
    const confirmations = new Set(rows.filter((r) => r.nextStatus === 'confirmed').map(activityKey)).size;
    const weeklySearch = new Set(rows.filter((r) => time(r.createdAt) >= weeklySinceMs && ['checked', 'pending'].includes(r.nextStatus)).map(activityKey)).size;
    const weeklyConfirmations = new Set(rows.filter((r) => time(r.createdAt) >= weeklySinceMs && r.nextStatus === 'confirmed').map(activityKey)).size;
    const discoveriesCount = maps.discoveries.get(userId) || 0; const uptime = maps.uptime.get(userId) || 0;
    const pendingCount = maps.pending.get(userId) || 0; const verified = maps.verified.get(userId) || 0;
    return {
      userId, ign, verifiedDiscoveries: discoveriesCount, feebasUptimeCreatedMinutes: uptime, confirmations, searchCoverage,
      weeklyContributionScore: (maps.weeklyDiscoveries.get(userId) || 0) * 100 + (maps.weeklyUptime.get(userId) || 0) / 60 + weeklyConfirmations * 25 + weeklySearch * 2,
      allTimeContributionScore: discoveriesCount * 100 + uptime / 60 + confirmations * 25 + searchCoverage * 2,
      fastestFindSeconds: maps.fastest.get(userId) ?? null,
      earlyScoutSeconds: Math.min(...rows.map((r) => Math.max((time(r.createdAt) - time(r.cycleStart)) / 1000, 0))),
      efficiency: searchCoverage ? discoveriesCount / searchCoverage : 0,
      reportAccuracy: pendingCount ? verified / pendingCount : 0,
      currentStreak: streaks.get(String(userId)) || 0, mostPersistentChecks: maps.persistent.get(userId) ?? null,
      pendingReports: pendingCount, verifiedReports: verified,
      weeklyPendingReports: maps.weeklyPending.get(userId) || 0, weeklyVerifiedReports: maps.weeklyVerified.get(userId) || 0,
    };
  });
}

function createFeebasLeaderboard({ dialect, parameter, runCommand, runOne, runSelect }) {
  const snapshotCache = new Map();
  const changedRows = (result) => {
    const value = result?.meta?.changes ?? result?.changes ?? result?.rowCount;
    return value === null || value === undefined ? null : number(value);
  };
  const scopeFor = (location) => getLeaderboardLocationIds(location).join('+');

  async function markDirty(location) {
    const scope = scopeFor(location);
    snapshotCache.delete(scope);
    const locations = JSON.stringify(getLeaderboardLocationIds(location));
    if (dialect === 'd1') {
      await runCommand(`INSERT INTO feebas_leaderboard_snapshots (scope, locations_json, dirty)
        VALUES (?, ?, 1) ON CONFLICT(scope) DO UPDATE SET dirty = 1`, [scope, locations]);
    } else {
      await runCommand(`INSERT INTO feebas_leaderboard_snapshots (scope, locations_json, dirty)
        VALUES ($1, $2, true) ON CONFLICT(scope) DO UPDATE SET dirty = true`, [scope, locations]);
    }
  }

  async function rebuild(location, now, existing = null) {
    const scope = scopeFor(location);
    const leaseUntil = new Date(now.getTime() + LEADERBOARD_REFRESH_LEASE_MS).toISOString();
    const lease = await runCommand(`UPDATE feebas_leaderboard_snapshots SET refresh_lease_until = ${parameter(1)}
      WHERE scope = ${parameter(2)} AND (refresh_lease_until IS NULL OR refresh_lease_until < ${parameter(3)})`, [leaseUntil, scope, now.toISOString()]);
    if (changedRows(lease) === 0) {
      if (existing?.entries_json) return existing;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const concurrentSnapshot = await runOne(`SELECT * FROM feebas_leaderboard_snapshots WHERE scope = ${parameter(1)}`, [scope]);
        if (concurrentSnapshot?.entries_json) return concurrentSnapshot;
      }
      throw new Error(`Leaderboard snapshot refresh lease for ${scope} did not complete`);
    }
    const locations = getLeaderboardLocationIds(location);
    const placeholders = locations.map((_, index) => parameter(index + 1)).join(', ');
    try {
      const rows = await runSelect(`SELECT logs.id, logs.location, logs.cycle_id, logs.tile_id, logs.next_status,
          logs.actor_fingerprint, logs.created_at, cycles.cycle_start, cycles.cycle_end
        FROM feebas_activity_logs logs JOIN feebas_cycles cycles ON cycles.id = logs.cycle_id
        WHERE logs.location IN (${placeholders}) ORDER BY logs.created_at ASC, logs.id ASC`, locations, 'feebas.leaderboard.activity');
      const users = await runSelect('SELECT id, ign FROM app_users', [], 'feebas.leaderboard.users');
      const weeklySince = new Date(now.getTime() - LEADERBOARD_WEEK_MS);
      const entries = computeEntries(rows, users, weeklySince);
      const nextExpiryMs = rows.map((row) => time(row.created_at) + LEADERBOARD_WEEK_MS)
        .filter((value) => value > now.getTime()).sort((a, b) => a - b)[0] || now.getTime() + LEADERBOARD_WEEK_MS;
      const sourceId = rows.length ? rows[rows.length - 1].id : null;
      const values = [scope, JSON.stringify(locations), now.toISOString(), weeklySince.toISOString(), new Date(nextExpiryMs).toISOString(), sourceId, JSON.stringify(entries)];
      if (dialect === 'd1') {
        await runCommand(`INSERT INTO feebas_leaderboard_snapshots
          (scope, locations_json, generated_at, weekly_since, next_weekly_expiration, source_activity_id, dirty, refresh_lease_until, entries_json)
          VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?) ON CONFLICT(scope) DO UPDATE SET
          locations_json=excluded.locations_json, generated_at=excluded.generated_at, weekly_since=excluded.weekly_since,
          next_weekly_expiration=excluded.next_weekly_expiration, source_activity_id=excluded.source_activity_id,
          dirty=0, refresh_lease_until=NULL, entries_json=excluded.entries_json`, values);
      } else {
        await runCommand(`INSERT INTO feebas_leaderboard_snapshots
          (scope, locations_json, generated_at, weekly_since, next_weekly_expiration, source_activity_id, dirty, refresh_lease_until, entries_json)
          VALUES ($1, $2, $3, $4, $5, $6, false, NULL, $7) ON CONFLICT(scope) DO UPDATE SET
          locations_json=EXCLUDED.locations_json, generated_at=EXCLUDED.generated_at, weekly_since=EXCLUDED.weekly_since,
          next_weekly_expiration=EXCLUDED.next_weekly_expiration, source_activity_id=EXCLUDED.source_activity_id,
          dirty=false, refresh_lease_until=NULL, entries_json=EXCLUDED.entries_json`, values);
      }
      const snapshot = {
        scope,
        locations_json: values[1],
        generated_at: values[2],
        weekly_since: values[3],
        next_weekly_expiration: values[4],
        source_activity_id: values[5],
        dirty: 0,
        refresh_lease_until: null,
        entries_json: values[6],
      };
      snapshotCache.set(scope, { snapshot, expiresAt: Date.now() + SNAPSHOT_READ_CACHE_MS });
      return snapshot;
    } catch (error) {
      await runCommand(`UPDATE feebas_leaderboard_snapshots SET refresh_lease_until = NULL WHERE scope = ${parameter(1)}`, [scope]).catch(() => undefined);
      console.error(JSON.stringify({ event: 'feebas_leaderboard_refresh_failed', scope, message: String(error?.message || error) }));
      throw error;
    }
  }

  async function getLeaderboard(location, options = {}) {
    const now = options.now ? new Date(options.now) : new Date();
    const scope = scopeFor(location);
    const cached = snapshotCache.get(scope);
    let snapshot = cached?.expiresAt > Date.now()
      ? cached.snapshot
      : await runOne(`SELECT * FROM feebas_leaderboard_snapshots WHERE scope = ${parameter(1)}`, [scope]);
    if (snapshot?.entries_json) {
      snapshotCache.set(scope, { snapshot, expiresAt: Date.now() + SNAPSHOT_READ_CACHE_MS });
    }
    if (!snapshot?.entries_json) {
      if (!snapshot) await markDirty(location);
      snapshot = await rebuild(location, now, snapshot);
    } else if (number(snapshot.dirty) === 1 || time(snapshot.next_weekly_expiration) <= now.getTime()) {
      const refresh = rebuild(location, now, snapshot).catch(() => snapshot);
      if (typeof options.waitUntil === 'function') options.waitUntil(refresh);
      else await refresh;
    }
    return responseFromSnapshot(location, snapshot, options);
  }

  return { getLeaderboard, markDirty };
}

module.exports = { LEADERBOARD_SORT_OPTIONS, createFeebasLeaderboard };
