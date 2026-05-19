const {
  FEEBAS_VOTABLE_STATUSES,
  FeebasRuleError,
  getCycleWindow,
  getLocationConfig,
  sanitizeActorName,
  sanitizeFingerprint,
  validateStatus,
} = require('../utils/feebas');

const DEFAULT_LEADERBOARD_LIMIT = 10;
const MAX_LEADERBOARD_LIMIT = 50;
const LEADERBOARD_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
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
const LEADERBOARD_SORT_OPTION_KEYS = new Set(LEADERBOARD_SORT_OPTIONS.map((option) => option.key));
const DEFAULT_LEADERBOARD_SORT_BY = 'rank';
const DEFAULT_LEADERBOARD_SORT_DIRECTION = 'asc';

function normalizeLeaderboardLimit(limit) {
  const parsed = Number.parseInt(limit, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LEADERBOARD_LIMIT;
  }

  return Math.min(Math.max(parsed, 1), MAX_LEADERBOARD_LIMIT);
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toTimeMs(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeLeaderboardSortBy(sortBy) {
  return LEADERBOARD_SORT_OPTION_KEYS.has(sortBy) ? sortBy : DEFAULT_LEADERBOARD_SORT_BY;
}

function normalizeLeaderboardSortDirection(sortDirection) {
  return sortDirection === 'desc' || sortDirection === 'asc'
    ? sortDirection
    : DEFAULT_LEADERBOARD_SORT_DIRECTION;
}

function compareNumbers(left, right) {
  return toFiniteNumber(left) - toFiniteNumber(right);
}

function compareActivity(left, right) {
  return (
    compareNumbers(toTimeMs(left.createdAt), toTimeMs(right.createdAt))
    || compareNumbers(left.id, right.id)
  );
}

function compareLeaderboardDefault(left, right) {
  return (
    compareNumbers(right.allTimeContributionScore, left.allTimeContributionScore)
    || compareNumbers(right.verifiedDiscoveries, left.verifiedDiscoveries)
    || compareNumbers(right.feebasUptimeCreatedMinutes, left.feebasUptimeCreatedMinutes)
    || compareNumbers(right.confirmations, left.confirmations)
    || compareNumbers(right.searchCoverage, left.searchCoverage)
    || left.ign.localeCompare(right.ign)
  );
}

function compareLeaderboardEntries(left, right, sortBy) {
  if (sortBy === 'rank') {
    return compareLeaderboardDefault(left, right);
  }

  if (sortBy === 'ign') {
    return left.ign.localeCompare(right.ign);
  }

  return (
    compareNumbers(left[sortBy], right[sortBy])
    || compareLeaderboardDefault(left, right)
  );
}

function sortLeaderboardEntries(entries, sortBy, sortDirection) {
  const directionMultiplier = sortDirection === 'desc' ? -1 : 1;

  return [...entries].sort((left, right) => (
    compareLeaderboardEntries(left, right, sortBy) * directionMultiplier
  ));
}

function buildCurrentStreaks(rows) {
  const cycleKeysByMostRecent = [];
  const seenCycles = new Set();
  const userCycleKeys = new Map();

  rows.forEach((row) => {
    const cycleKey = String(row.cycle_id);

    if (!seenCycles.has(cycleKey)) {
      seenCycles.add(cycleKey);
      cycleKeysByMostRecent.push(cycleKey);
    }

    const userKey = String(row.user_id);
    const cycles = userCycleKeys.get(userKey) || new Set();
    cycles.add(cycleKey);
    userCycleKeys.set(userKey, cycles);
  });

  return new Map(Array.from(userCycleKeys.entries()).map(([userId, cycles]) => {
    let streak = 0;

    for (const cycleKey of cycleKeysByMostRecent) {
      if (!cycles.has(cycleKey)) {
        break;
      }

      streak += 1;
    }

    return [userId, streak];
  }));
}

function getDominantStatus(voteCounts) {
  const ranked = [...FEEBAS_VOTABLE_STATUSES].sort((left, right) => {
    const countDiff = voteCounts[right] - voteCounts[left];
    if (countDiff !== 0) {
      return countDiff;
    }

    return FEEBAS_VOTABLE_STATUSES.indexOf(right) - FEEBAS_VOTABLE_STATUSES.indexOf(left);
  });

  return voteCounts[ranked[0]] > 0 ? ranked[0] : 'unchecked';
}

function addCount(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function addSum(map, key, amount) {
  map.set(key, (map.get(key) || 0) + toFiniteNumber(amount));
}

function minValue(map, key, value) {
  if (!map.has(key) || value < map.get(key)) {
    map.set(key, value);
  }
}

function uniqueActivityKey(activity) {
  return `${activity.cycleId}:${activity.tileId}`;
}

function createFeebasRepository({ dialect, parameter, runCommand, runOne, runSelect }) {
  const activeTimestampOrder = dialect === 'd1'
    ? 'datetime(created_at)'
    : 'created_at';
  const insertCycleSql = dialect === 'd1'
    ? `INSERT OR IGNORE INTO feebas_cycles (location, cycle_start, cycle_end)
       VALUES (?, ?, ?)`
    : `INSERT INTO feebas_cycles (location, cycle_start, cycle_end)
       VALUES ($1, $2, $3)
       ON CONFLICT (location, cycle_start) DO NOTHING`;
  const insertSnapshotSql = dialect === 'd1'
    ? `INSERT OR IGNORE INTO feebas_confirmed_tile_snapshots (
         location,
         source_cycle_id,
         cycle_start,
         cycle_end,
         tile_id,
         tile_label,
         confirmed_vote_count,
         archived_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    : `INSERT INTO feebas_confirmed_tile_snapshots (
         location,
         source_cycle_id,
         cycle_start,
         cycle_end,
         tile_id,
         tile_label,
         confirmed_vote_count,
         archived_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (source_cycle_id, tile_id) DO NOTHING`;

  async function getCycleByStart(location, cycleStart) {
    return runOne(`
      SELECT *
      FROM feebas_cycles
      WHERE location = ${parameter(1)} AND cycle_start = ${parameter(2)}
      LIMIT 1
    `, [location, toIsoString(cycleStart)]);
  }

  async function getPreviousCycle(location, cycleStart) {
    return runOne(`
      SELECT *
      FROM feebas_cycles
      WHERE location = ${parameter(1)} AND cycle_start < ${parameter(2)}
      ORDER BY cycle_start DESC
      LIMIT 1
    `, [location, toIsoString(cycleStart)]);
  }

  async function archiveConfirmedTilesForCycle(location, cycle, now = new Date()) {
    if (!cycle?.id) {
      return;
    }

    const snapshotRows = await runSelect(`
      SELECT tile_id, COUNT(*) AS confirmed_vote_count
      FROM feebas_tile_votes
      WHERE cycle_id = ${parameter(1)} AND status = 'confirmed'
      GROUP BY tile_id
    `, [cycle.id]);

    if (snapshotRows.length === 0) {
      return;
    }

    const locationConfig = getLocationConfig(location);
    const tileLabels = new Map(locationConfig.tiles.map((tile) => [tile.tileId, tile.label]));

    await Promise.all(snapshotRows.map((row) => runCommand(insertSnapshotSql, [
      location,
      cycle.id,
      toIsoString(cycle.cycle_start),
      toIsoString(cycle.cycle_end),
      row.tile_id,
      tileLabels.get(row.tile_id) || row.tile_id,
      Number(row.confirmed_vote_count) || 0,
      toIsoString(now),
    ])));
  }

  async function ensureCycle(location, cycleStart, cycleEnd) {
    const existingCycle = await getCycleByStart(location, cycleStart);
    if (existingCycle) {
      return existingCycle;
    }

    const previousCycle = await getPreviousCycle(location, cycleStart);
    await archiveConfirmedTilesForCycle(location, previousCycle);

    await runCommand(insertCycleSql, [location, toIsoString(cycleStart), toIsoString(cycleEnd)]);
    return getCycleByStart(location, cycleStart);
  }

  async function getTileVotesForUpdate(cycleId, tileId) {
    return runSelect(`
      SELECT *
      FROM feebas_tile_votes
      WHERE cycle_id = ${parameter(1)} AND tile_id = ${parameter(2)}
    `, [cycleId, tileId]);
  }

  async function applyTileVote(cycleId, tileId, { currentVote, pendingVote, actorFingerprint, actorName, nextStatus, now }) {
    if (nextStatus === 'unchecked') {
      if (!currentVote) {
        return;
      }

      await runCommand(`
        DELETE FROM feebas_tile_votes
        WHERE id = ${parameter(1)}
      `, [currentVote.id]);
      return;
    }

    if (pendingVote && pendingVote.actor_fingerprint !== actorFingerprint && ['checked', 'confirmed'].includes(nextStatus)) {
      await runCommand(`
        DELETE FROM feebas_tile_votes
        WHERE id = ${parameter(1)}
      `, [pendingVote.id]);
    }

    if (currentVote) {
      await runCommand(`
        UPDATE feebas_tile_votes
        SET status = ${parameter(2)},
            actor_name = ${parameter(3)},
            updated_at = ${parameter(4)}
        WHERE id = ${parameter(1)}
      `, [currentVote.id, nextStatus, actorName, toIsoString(now)]);
      return;
    }

    await runCommand(`
      INSERT INTO feebas_tile_votes (
        cycle_id,
        tile_id,
        actor_fingerprint,
        actor_name,
        status,
        created_at,
        updated_at
      )
      VALUES (${parameter(1)}, ${parameter(2)}, ${parameter(3)}, ${parameter(4)}, ${parameter(5)}, ${parameter(6)}, ${parameter(7)})
    `, [
      cycleId,
      tileId,
      actorFingerprint,
      actorName,
      nextStatus,
      toIsoString(now),
      toIsoString(now),
    ]);
  }

  async function insertActivityLog({
    cycleId,
    location,
    tileDefinition,
    previousStatus,
    nextStatus,
    actorName,
    actorFingerprint,
    now,
  }) {
    const actionType = nextStatus === 'unchecked'
      ? 'cleared_vote'
      : previousStatus
        ? 'changed_vote'
        : 'voted';

    await runCommand(`
      INSERT INTO feebas_activity_logs (
        cycle_id,
        location,
        tile_id,
        tile_label,
        action_type,
        previous_status,
        next_status,
        actor_name,
        actor_fingerprint,
        created_at
      )
      VALUES (
        ${parameter(1)}, ${parameter(2)}, ${parameter(3)}, ${parameter(4)}, ${parameter(5)},
        ${parameter(6)}, ${parameter(7)}, ${parameter(8)}, ${parameter(9)}, ${parameter(10)}
      )
    `, [
      cycleId,
      location,
      tileDefinition.tileId,
      tileDefinition.label,
      actionType,
      previousStatus,
      nextStatus,
      actorName,
      actorFingerprint,
      toIsoString(now),
    ]);
  }

  async function getLeaderboard(location, options = {}) {
    getLocationConfig(location);

    const now = options.now ? new Date(options.now) : new Date();
    const weeklySince = options.weeklySince
      ? new Date(options.weeklySince)
      : new Date(now.getTime() - LEADERBOARD_WEEK_MS);
    const weeklySinceMs = weeklySince.getTime();
    const limit = normalizeLeaderboardLimit(options.limit);
    const sortBy = normalizeLeaderboardSortBy(options.sortBy);
    const sortDirection = normalizeLeaderboardSortDirection(options.sortDirection);

    const activityRows = await runSelect(`
      SELECT
        logs.id,
        logs.location,
        logs.cycle_id,
        logs.tile_id,
        logs.tile_label,
        logs.next_status,
        logs.actor_fingerprint,
        logs.created_at,
        cycles.cycle_start,
        cycles.cycle_end
      FROM feebas_activity_logs logs
      JOIN feebas_cycles cycles ON cycles.id = logs.cycle_id
      WHERE logs.location = ${parameter(1)}
      ORDER BY logs.created_at ASC, logs.id ASC
    `, [location]);
    const users = await runSelect('SELECT id, ign FROM app_users', []);
    const userByFingerprint = new Map(users.map((user) => [`${ACCOUNT_FINGERPRINT_PREFIX}${user.id}`, user]));
    const allActivity = activityRows.map((row) => ({
      id: row.id,
      location: row.location,
      cycleId: String(row.cycle_id),
      cycle_id: row.cycle_id,
      tileId: row.tile_id,
      tileLabel: row.tile_label,
      nextStatus: row.next_status,
      actorFingerprint: row.actor_fingerprint,
      createdAt: row.created_at,
      cycleStart: row.cycle_start,
      cycleEnd: row.cycle_end,
    }));
    const loggedActivity = allActivity.flatMap((activity) => {
      const user = userByFingerprint.get(activity.actorFingerprint);
      return user
        ? [{ ...activity, userId: String(user.id), user_id: user.id, ign: user.ign }]
        : [];
    });

    const pendingReportsByKey = new Map();
    loggedActivity
      .filter((activity) => activity.nextStatus === 'pending')
      .forEach((activity) => {
        const key = `${activity.location}:${activity.cycleId}:${activity.tileId}:${activity.userId}`;
        const existing = pendingReportsByKey.get(key);
        if (!existing || compareActivity(activity, existing) < 0) {
          pendingReportsByKey.set(key, activity);
        }
      });
    const pendingReports = Array.from(pendingReportsByKey.values());

    const confirmedTiles = new Map();
    allActivity
      .filter((activity) => activity.nextStatus === 'confirmed')
      .forEach((activity) => {
        const key = `${activity.location}:${activity.cycleId}:${activity.tileId}`;
        const existing = confirmedTiles.get(key);
        if (!existing || compareActivity(activity, existing) < 0) {
          confirmedTiles.set(key, activity);
        }
      });

    const resolvedPendingReports = pendingReports.flatMap((report) => {
      const resolution = allActivity.find((activity) => (
        activity.location === report.location
        && activity.cycleId === report.cycleId
        && activity.tileId === report.tileId
        && toTimeMs(activity.createdAt) > toTimeMs(report.createdAt)
        && ['checked', 'confirmed'].includes(activity.nextStatus)
      ));

      return resolution
        ? [{ ...report, resolvedStatus: resolution.nextStatus, resolvedAt: resolution.createdAt }]
        : [];
    });

    const activeUsersByCycle = new Map();
    loggedActivity.forEach((activity) => {
      const usersForCycle = activeUsersByCycle.get(activity.cycleId) || new Set();
      usersForCycle.add(activity.userId);
      activeUsersByCycle.set(activity.cycleId, usersForCycle);
    });

    const firstReportsByTile = new Map();
    pendingReports.forEach((report) => {
      const key = `${report.location}:${report.cycleId}:${report.tileId}`;
      const existing = firstReportsByTile.get(key);
      const isEarlier = !existing
        || compareActivity(report, existing) < 0
        || (
          compareActivity(report, existing) === 0
          && String(report.userId).localeCompare(String(existing.userId)) < 0
        );

      if (isEarlier) {
        firstReportsByTile.set(key, report);
      }
    });

    const verifiedDiscoveries = Array.from(firstReportsByTile.values()).flatMap((report) => {
      const confirmedTile = confirmedTiles.get(`${report.location}:${report.cycleId}:${report.tileId}`);
      if (!confirmedTile) {
        return [];
      }

      const activeUserCount = activeUsersByCycle.get(report.cycleId)?.size || 1;
      const uptimeMinutes = Math.max((toTimeMs(report.cycleEnd) - toTimeMs(report.createdAt)) / 60000, 0) * activeUserCount;

      return [{
        ...report,
        reportedAt: report.createdAt,
        uptimeMinutes,
      }];
    });

    const discoveryCheckCounts = verifiedDiscoveries.map((discovery) => {
      const checkedTiles = new Set(
        loggedActivity
          .filter((activity) => (
            activity.userId === discovery.userId
            && activity.cycleId === discovery.cycleId
            && toTimeMs(activity.createdAt) <= toTimeMs(discovery.reportedAt)
            && ['checked', 'pending'].includes(activity.nextStatus)
          ))
          .map((activity) => activity.tileId)
      );

      return {
        userId: discovery.userId,
        checksToFind: checkedTiles.size,
      };
    });

    const verifiedDiscoveriesCount = new Map();
    const feebasUptimeCreatedMinutes = new Map();
    const weeklyVerifiedDiscoveries = new Map();
    const weeklyFeebasUptimeCreatedMinutes = new Map();
    const fastestFindSeconds = new Map();

    verifiedDiscoveries.forEach((discovery) => {
      addCount(verifiedDiscoveriesCount, discovery.userId);
      addSum(feebasUptimeCreatedMinutes, discovery.userId, discovery.uptimeMinutes);
      minValue(
        fastestFindSeconds,
        discovery.userId,
        Math.max((toTimeMs(discovery.reportedAt) - toTimeMs(discovery.cycleStart)) / 1000, 0)
      );

      if (toTimeMs(discovery.reportedAt) >= weeklySinceMs) {
        addCount(weeklyVerifiedDiscoveries, discovery.userId);
        addSum(weeklyFeebasUptimeCreatedMinutes, discovery.userId, discovery.uptimeMinutes);
      }
    });

    const pendingReportsCount = new Map();
    const verifiedReportsCount = new Map();
    const weeklyPendingReports = new Map();
    const weeklyVerifiedReports = new Map();
    resolvedPendingReports.forEach((report) => {
      addCount(pendingReportsCount, report.userId);
      if (report.resolvedStatus === 'confirmed') {
        addCount(verifiedReportsCount, report.userId);
      }

      if (toTimeMs(report.createdAt) >= weeklySinceMs) {
        addCount(weeklyPendingReports, report.userId);
        if (report.resolvedStatus === 'confirmed') {
          addCount(weeklyVerifiedReports, report.userId);
        }
      }
    });

    const activityByUser = new Map();
    loggedActivity.forEach((activity) => {
      if (!activityByUser.has(activity.userId)) {
        activityByUser.set(activity.userId, { userId: activity.userId, ign: activity.ign, entries: [] });
      }
      activityByUser.get(activity.userId).entries.push(activity);
    });

    const mostPersistentChecks = new Map();
    discoveryCheckCounts.forEach((entry) => {
      if (!mostPersistentChecks.has(entry.userId) || entry.checksToFind > mostPersistentChecks.get(entry.userId)) {
        mostPersistentChecks.set(entry.userId, entry.checksToFind);
      }
    });

    const streakRowsByKey = new Map();
    loggedActivity.forEach((activity) => {
      const key = `${activity.userId}:${activity.cycleId}`;
      if (!streakRowsByKey.has(key)) {
        streakRowsByKey.set(key, {
          user_id: activity.userId,
          cycle_id: activity.cycle_id,
          cycle_start: activity.cycleStart,
        });
      }
    });
    const streakRows = Array.from(streakRowsByKey.values())
      .sort((left, right) => (
        compareNumbers(toTimeMs(right.cycle_start), toTimeMs(left.cycle_start))
        || compareNumbers(right.cycle_id, left.cycle_id)
      ));
    const streaksByUser = buildCurrentStreaks(streakRows);

    const entries = Array.from(activityByUser.values()).map(({ userId, ign, entries: activityEntries }) => {
      const earlyScoutSeconds = activityEntries.reduce((minimum, activity) => (
        Math.min(minimum, Math.max((toTimeMs(activity.createdAt) - toTimeMs(activity.cycleStart)) / 1000, 0))
      ), Number.POSITIVE_INFINITY);
      const searchCoverage = new Set(activityEntries
        .filter((activity) => ['checked', 'pending'].includes(activity.nextStatus))
        .map(uniqueActivityKey)).size;
      const confirmations = new Set(activityEntries
        .filter((activity) => activity.nextStatus === 'confirmed')
        .map(uniqueActivityKey)).size;
      const weeklySearchCoverage = new Set(activityEntries
        .filter((activity) => (
          ['checked', 'pending'].includes(activity.nextStatus)
          && toTimeMs(activity.createdAt) >= weeklySinceMs
        ))
        .map(uniqueActivityKey)).size;
      const weeklyConfirmations = new Set(activityEntries
        .filter((activity) => activity.nextStatus === 'confirmed' && toTimeMs(activity.createdAt) >= weeklySinceMs)
        .map(uniqueActivityKey)).size;
      const verifiedDiscoveriesValue = verifiedDiscoveriesCount.get(userId) || 0;
      const uptimeValue = feebasUptimeCreatedMinutes.get(userId) || 0;
      const weeklyVerifiedValue = weeklyVerifiedDiscoveries.get(userId) || 0;
      const weeklyUptimeValue = weeklyFeebasUptimeCreatedMinutes.get(userId) || 0;
      const pendingReportsValue = pendingReportsCount.get(userId) || 0;
      const verifiedReportsValue = verifiedReportsCount.get(userId) || 0;

      return {
        userId,
        ign,
        verifiedDiscoveries: verifiedDiscoveriesValue,
        feebasUptimeCreatedMinutes: uptimeValue,
        confirmations,
        searchCoverage,
        weeklyContributionScore: (
          weeklyVerifiedValue * 100
          + (weeklyUptimeValue / 60)
          + weeklyConfirmations * 25
          + weeklySearchCoverage * 2
        ),
        allTimeContributionScore: (
          verifiedDiscoveriesValue * 100
          + (uptimeValue / 60)
          + confirmations * 25
          + searchCoverage * 2
        ),
        fastestFindSeconds: fastestFindSeconds.has(userId) ? fastestFindSeconds.get(userId) : null,
        earlyScoutSeconds: Number.isFinite(earlyScoutSeconds) ? earlyScoutSeconds : null,
        efficiency: searchCoverage > 0 ? verifiedDiscoveriesValue / searchCoverage : 0,
        reportAccuracy: pendingReportsValue > 0 ? verifiedReportsValue / pendingReportsValue : 0,
        currentStreak: streaksByUser.get(String(userId)) || 0,
        mostPersistentChecks: mostPersistentChecks.has(userId) ? mostPersistentChecks.get(userId) : null,
        pendingReports: pendingReportsValue,
        verifiedReports: verifiedReportsValue,
        weeklyPendingReports: weeklyPendingReports.get(userId) || 0,
        weeklyVerifiedReports: weeklyVerifiedReports.get(userId) || 0,
      };
    });
    const rankedEntries = sortLeaderboardEntries(entries, sortBy, sortDirection)
      .map((entry, index) => ({
        rank: index + 1,
        ...entry,
        verifiedDiscoveries: toFiniteNumber(entry.verifiedDiscoveries),
        feebasUptimeCreatedMinutes: toFiniteNumber(entry.feebasUptimeCreatedMinutes),
        confirmations: toFiniteNumber(entry.confirmations),
        searchCoverage: toFiniteNumber(entry.searchCoverage),
        weeklyContributionScore: toFiniteNumber(entry.weeklyContributionScore),
        allTimeContributionScore: toFiniteNumber(entry.allTimeContributionScore),
        fastestFindSeconds: toFiniteNumber(entry.fastestFindSeconds, null),
        earlyScoutSeconds: toFiniteNumber(entry.earlyScoutSeconds, null),
        efficiency: toFiniteNumber(entry.efficiency),
        reportAccuracy: toFiniteNumber(entry.reportAccuracy),
        currentStreak: toFiniteNumber(entry.currentStreak),
        mostPersistentChecks: toFiniteNumber(entry.mostPersistentChecks, null),
        pendingReports: toFiniteNumber(entry.pendingReports),
        verifiedReports: toFiniteNumber(entry.verifiedReports),
      }));
    const limitedEntries = rankedEntries.slice(0, limit);
    const currentUserId = options.currentUserId ? String(options.currentUserId) : null;
    const currentUserEntry = currentUserId
      ? rankedEntries.find((entry) => String(entry.userId) === currentUserId)
      : null;
    const sortedEntries = currentUserEntry && currentUserEntry.rank > limit
      ? [...limitedEntries, currentUserEntry]
      : limitedEntries;

    return {
      location,
      generatedAt: now.toISOString(),
      weeklySince: weeklySince.toISOString(),
      sort: {
        by: sortBy,
        direction: sortDirection,
      },
      sortOptions: LEADERBOARD_SORT_OPTIONS.map((option) => ({ ...option })),
      entries: sortedEntries,
    };
  }

  async function getBoardForCycle(location, cycle, now = new Date(), actorFingerprint = null, options = {}) {
    const locationConfig = getLocationConfig(location);
    const includeLeaderboard = options.includeLeaderboard !== false;
    const votes = await runSelect(`
      SELECT tile_id, actor_fingerprint, actor_name, status
      FROM feebas_tile_votes
      WHERE cycle_id = ${parameter(1)}
    `, [cycle.id]);
    const previousConfirmedTiles = await runSelect(`
      SELECT tile_id, SUM(confirmed_vote_count) AS confirmations
      FROM feebas_confirmed_tile_snapshots
      WHERE location = ${parameter(1)}
      GROUP BY tile_id
    `, [location]);
    const activityRows = await runSelect(`
      SELECT *
      FROM feebas_activity_logs
      WHERE cycle_id = ${parameter(1)}
      ORDER BY ${activeTimestampOrder} DESC, id DESC
      LIMIT 20
    `, [cycle.id]);
    const leaderboard = includeLeaderboard
      ? await getLeaderboard(location, { now, currentUserId: options.currentUserId })
      : undefined;
    const votesByTile = votes.reduce((map, row) => {
      const existing = map.get(row.tile_id) || [];
      existing.push(row);
      map.set(row.tile_id, existing);
      return map;
    }, new Map());

    const tiles = locationConfig.tiles.map((tileDefinition) => {
      const tileVotes = votesByTile.get(tileDefinition.tileId) || [];
      const voteCounts = {
        checked: tileVotes.filter((vote) => vote.status === 'checked').length,
        pending: tileVotes.filter((vote) => vote.status === 'pending').length,
        confirmed: tileVotes.filter((vote) => vote.status === 'confirmed').length,
      };

      return {
        ...tileDefinition,
        status: getDominantStatus(voteCounts),
        voteCounts,
        totalVotes: voteCounts.checked + voteCounts.pending + voteCounts.confirmed,
      };
    });

    const baseBoard = {
      location: locationConfig.id,
      displayName: locationConfig.displayName,
      description: locationConfig.description,
      cycleStart: toIsoString(cycle.cycle_start),
      cycleEnd: toIsoString(cycle.cycle_end),
      serverTime: now.toISOString(),
      resetIntervalMinutes: 45,
      requiresDistinctConfirmation: false,
      confirmedTileId: null,
      isLocked: false,
      previousConfirmedTiles: previousConfirmedTiles.map((entry) => ({
        tileId: entry.tile_id,
        confirmations: Number(entry.confirmations) || 0,
      })),
      layout: {
        rows: locationConfig.rows,
        cols: locationConfig.cols,
      },
      activity: activityRows.map((entry) => ({
        id: entry.id,
        tileId: entry.tile_id,
        tileLabel: entry.tile_label,
        actionType: entry.action_type,
        previousStatus: entry.previous_status,
        nextStatus: entry.next_status === 'unchecked' ? null : entry.next_status,
        actorName: entry.actor_name,
        createdAt: toIsoString(entry.created_at),
      })),
      ...(includeLeaderboard ? { leaderboard } : {}),
      tiles,
      votesByTile,
    };

    return applyUserViewToBoardCache(baseBoard, actorFingerprint);
  }

  function applyUserViewToBoardCache(boardCache, actorFingerprint) {
    if (!actorFingerprint) {
      const { votesByTile, ...baseBoard } = boardCache;
      return baseBoard;
    }

    return {
      ...boardCache,
      tiles: boardCache.tiles.map((tile) => {
        const tileVotes = boardCache.votesByTile.get(tile.tileId) || [];
        const currentUserVote = tileVotes.find((vote) => vote.actor_fingerprint === actorFingerprint)?.status || 'unchecked';
        return { ...tile, currentUserVote };
      }),
    };
  }

  async function getBoardCache(location, options = {}) {
    const now = options.now ? new Date(options.now) : new Date();
    const { cycleStart, cycleEnd } = getCycleWindow(now);
    const cycle = await ensureCycle(location, cycleStart, cycleEnd);

    return getBoardForCycle(location, cycle, now, null, { includeLeaderboard: false }).then(board => ({
      ...board,
      votesByTile: board.votesByTile,
    }));
  }

  return {
    getLeaderboardSortOptions() {
      return LEADERBOARD_SORT_OPTIONS.map((option) => ({ ...option }));
    },

    async getBoard(location, options = {}) {
      const now = options.now ? new Date(options.now) : new Date();
      const actorFingerprint = sanitizeFingerprint(options.actorFingerprint);
      const includeLeaderboard = options.includeLeaderboard !== false;
      const { cycleStart, cycleEnd } = getCycleWindow(now);
      const cycle = await ensureCycle(location, cycleStart, cycleEnd);

      return getBoardForCycle(location, cycle, now, actorFingerprint, {
        includeLeaderboard,
        currentUserId: options.currentUserId,
      });
    },

    async resetBoard(location, options = {}) {
      const now = options.now ? new Date(options.now) : new Date();
      getLocationConfig(location);

      const { cycleStart } = getCycleWindow(now);
      const existingCycle = await getCycleByStart(location, cycleStart);
      if (existingCycle) {
        await archiveConfirmedTilesForCycle(location, existingCycle, now);
      }

      await runCommand(`
        DELETE FROM feebas_cycles
        WHERE location = ${parameter(1)} AND cycle_start = ${parameter(2)}
      `, [location, cycleStart.toISOString()]);

      return this.getBoard(location, { now });
    },

    async getBoardCache(location, options = {}) {
      const now = options.now ? new Date(options.now) : new Date();
      const { cycleStart, cycleEnd } = getCycleWindow(now);
      const cycle = await ensureCycle(location, cycleStart, cycleEnd);

      const votes = await runSelect(`
        SELECT tile_id, actor_fingerprint, actor_name, status
        FROM feebas_tile_votes
        WHERE cycle_id = ${parameter(1)}
      `, [cycle.id]);
      const previousConfirmedTiles = await runSelect(`
        SELECT tile_id, SUM(confirmed_vote_count) AS confirmations
        FROM feebas_confirmed_tile_snapshots
        WHERE location = ${parameter(1)}
        GROUP BY tile_id
      `, [location]);
      const activityRows = await runSelect(`
        SELECT *
        FROM feebas_activity_logs
        WHERE cycle_id = ${parameter(1)}
        ORDER BY ${activeTimestampOrder} DESC, id DESC
        LIMIT 20
      `, [cycle.id]);

      const locationConfig = getLocationConfig(location);
      const votesByTile = votes.reduce((map, row) => {
        const existing = map.get(row.tile_id) || [];
        existing.push(row);
        map.set(row.tile_id, existing);
        return map;
      }, new Map());

      const tiles = locationConfig.tiles.map((tileDefinition) => {
        const tileVotes = votesByTile.get(tileDefinition.tileId) || [];
        const voteCounts = {
          checked: tileVotes.filter((vote) => vote.status === 'checked').length,
          pending: tileVotes.filter((vote) => vote.status === 'pending').length,
          confirmed: tileVotes.filter((vote) => vote.status === 'confirmed').length,
        };

        return {
          ...tileDefinition,
          status: getDominantStatus(voteCounts),
          voteCounts,
          totalVotes: voteCounts.checked + voteCounts.pending + voteCounts.confirmed,
        };
      });

      return {
        location: locationConfig.id,
        displayName: locationConfig.displayName,
        description: locationConfig.description,
        cycleStart: toIsoString(cycle.cycle_start),
        cycleEnd: toIsoString(cycle.cycle_end),
        serverTime: now.toISOString(),
        resetIntervalMinutes: 45,
        requiresDistinctConfirmation: false,
        confirmedTileId: null,
        isLocked: false,
        previousConfirmedTiles: previousConfirmedTiles.map((entry) => ({
          tileId: entry.tile_id,
          confirmations: Number(entry.confirmations) || 0,
        })),
        layout: {
          rows: locationConfig.rows,
          cols: locationConfig.cols,
        },
        activity: activityRows.map((entry) => ({
          id: entry.id,
          tileId: entry.tile_id,
          tileLabel: entry.tile_label,
          actionType: entry.action_type,
          previousStatus: entry.previous_status,
          nextStatus: entry.next_status === 'unchecked' ? null : entry.next_status,
          actorName: entry.actor_name,
          createdAt: toIsoString(entry.created_at),
        })),
        tiles,
        votesByTile,
      };
    },

    applyUserViewToBoardCache(boardCache, actorFingerprint) {
      if (!actorFingerprint) {
        const { votesByTile, ...baseBoard } = boardCache;
        return baseBoard;
      }

      return {
        ...boardCache,
        tiles: boardCache.tiles.map((tile) => {
          const tileVotes = boardCache.votesByTile.get(tile.tileId) || [];
          const currentUserVote = tileVotes.find((vote) => vote.actor_fingerprint === actorFingerprint)?.status || 'unchecked';
          return { ...tile, currentUserVote };
        }),
      };
    },

    async updateTile(location, tileId, payload, options = {}) {
      const actorFingerprint = sanitizeFingerprint(payload?.actorFingerprint);
      if (!actorFingerprint) {
        throw new FeebasRuleError('A browser fingerprint is required to update Feebas tiles');
      }

      const actorName = sanitizeActorName(payload?.actorName);
      const nextStatus = validateStatus(payload?.status);
      const now = options.now ? new Date(options.now) : new Date();
      const locationConfig = getLocationConfig(location);
      const tileDefinition = locationConfig.tiles.find((tile) => tile.tileId === tileId);

      if (!tileDefinition) {
        throw new FeebasRuleError('Feebas tile not found', 404);
      }

      const { cycleStart, cycleEnd } = getCycleWindow(now);
      const cycle = await ensureCycle(location, cycleStart, cycleEnd);
      const tileVotes = await getTileVotesForUpdate(cycle.id, tileId);
      const currentVote = tileVotes.find((vote) => vote.actor_fingerprint === actorFingerprint) || null;
      const pendingVote = tileVotes.find((vote) => vote.status === 'pending') || null;
      const isNoOp = currentVote?.status === nextStatus || (!currentVote && nextStatus === 'unchecked');

      if (isNoOp) {
        return getBoardForCycle(
          location,
          { ...cycle, cycle_start: cycleStart, cycle_end: cycleEnd },
          now,
          actorFingerprint,
          {
            includeLeaderboard: options.includeLeaderboard !== false,
            currentUserId: options.currentUserId,
          },
        );
      }

      if (nextStatus === 'pending' && pendingVote && pendingVote.actor_fingerprint !== actorFingerprint) {
        throw new FeebasRuleError('Only one pending vote can exist on a tile at a time');
      }

      if (nextStatus === 'confirmed' && !pendingVote) {
        throw new FeebasRuleError('Confirmed votes require at least one pending vote on the tile');
      }

      if (nextStatus === 'confirmed' && pendingVote?.actor_fingerprint === actorFingerprint) {
        throw new FeebasRuleError('The player who marked a tile pending cannot confirm it');
      }

      await applyTileVote(cycle.id, tileId, {
        currentVote,
        pendingVote,
        actorFingerprint,
        actorName,
        nextStatus,
        now,
      });
      await insertActivityLog({
        cycleId: cycle.id,
        location,
        tileDefinition,
        previousStatus: currentVote?.status || null,
        nextStatus,
        actorName,
        actorFingerprint,
        now,
      });

      return getBoardForCycle(
        location,
        { ...cycle, cycle_start: cycleStart, cycle_end: cycleEnd },
        now,
        actorFingerprint,
        {
          includeLeaderboard: options.includeLeaderboard !== false,
          currentUserId: options.currentUserId,
        },
      );
    },

    getLeaderboard,
  };
}

module.exports = {
  LEADERBOARD_SORT_OPTIONS,
  createFeebasRepository,
};
