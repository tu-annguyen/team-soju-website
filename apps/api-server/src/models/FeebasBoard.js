const pool = require('../config/connection');
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

function normalizeLeaderboardSortBy(sortBy) {
  return LEADERBOARD_SORT_OPTION_KEYS.has(sortBy) ? sortBy : DEFAULT_LEADERBOARD_SORT_BY;
}

function normalizeLeaderboardSortDirection(sortDirection) {
  return sortDirection === 'desc' || sortDirection === 'asc'
    ? sortDirection
    : DEFAULT_LEADERBOARD_SORT_DIRECTION;
}

function getActivityActorName(entry) {
  if (String(entry.actor_fingerprint || '').startsWith(ACCOUNT_FINGERPRINT_PREFIX)) {
    return entry.actor_name;
  }

  return null;
}

function compareNumbers(left, right) {
  return (toFiniteNumber(left) - toFiniteNumber(right));
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

class FeebasBoard {
  static getLeaderboardSortOptions() {
    return LEADERBOARD_SORT_OPTIONS.map((option) => ({ ...option }));
  }

  static async getBoard(location, options = {}) {
    const client = options.client || pool;
    const now = options.now ? new Date(options.now) : new Date();
    const actorFingerprint = sanitizeFingerprint(options.actorFingerprint);
    const currentUserId = options.currentUserId ? String(options.currentUserId) : null;
    const includeLeaderboard = options.includeLeaderboard !== false;
    const { cycleStart, cycleEnd } = getCycleWindow(now);

    const cycle = await this.ensureCycle(client, location, cycleStart, cycleEnd);
    return this.getBoardForCycle(client, location, cycle, now, actorFingerprint, { includeLeaderboard, currentUserId });
  }

  static async resetBoard(location, options = {}) {
    const now = options.now ? new Date(options.now) : new Date();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      getLocationConfig(location);
      const { cycleStart } = getCycleWindow(now);
      const existingCycle = await this.getCycleByStart(client, location, cycleStart);

      if (existingCycle) {
        await this.archiveConfirmedTilesForCycle(client, location, existingCycle, now);
      }

      await client.query(`
        DELETE FROM feebas_cycles
        WHERE location = $1 AND cycle_start = $2
      `, [location, cycleStart.toISOString()]);

      const board = await this.getBoard(location, { client, now });

      await client.query('COMMIT');
      return board;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateTile(location, tileId, payload, options = {}) {
    const actorFingerprint = sanitizeFingerprint(payload?.actorFingerprint);
    if (!actorFingerprint) {
      throw new FeebasRuleError('A browser fingerprint is required to update Feebas tiles');
    }

    const actorName = sanitizeActorName(payload?.actorName);
    const nextStatus = validateStatus(payload?.status);
    const now = options.now ? new Date(options.now) : new Date();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const locationConfig = getLocationConfig(location);
      const tileDefinition = locationConfig.tiles.find((tile) => tile.tileId === tileId);

      if (!tileDefinition) {
        throw new FeebasRuleError('Feebas tile not found', 404);
      }

      const { cycleStart, cycleEnd } = getCycleWindow(now);
      const cycle = await this.ensureCycle(client, location, cycleStart, cycleEnd);
      const tileVotes = await this.getTileVotesForUpdate(client, cycle.id, tileId);
      const currentVote = tileVotes.find((vote) => vote.actor_fingerprint === actorFingerprint) || null;
      const pendingVote = tileVotes.find((vote) => vote.status === 'pending') || null;
      const isNoOp = currentVote?.status === nextStatus || (!currentVote && nextStatus === 'unchecked');

      if (isNoOp) {
        const board = await this.getBoardForCycle(
          client,
          location,
          { ...cycle, cycle_start: cycleStart, cycle_end: cycleEnd },
          now,
          actorFingerprint,
          { includeLeaderboard: options.includeLeaderboard !== false },
        );

        await client.query('COMMIT');
        return board;
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

      await this.applyTileVote(client, cycle.id, tileId, {
        currentVote,
        pendingVote,
        actorFingerprint,
        actorName,
        nextStatus,
        now,
      });

      await this.insertActivityLog(client, {
        cycleId: cycle.id,
        location,
        tileDefinition,
        previousStatus: currentVote?.status || null,
        nextStatus,
        actorName,
        actorFingerprint,
        now,
      });

      const board = await this.getBoardForCycle(
        client,
        location,
        { ...cycle, cycle_start: cycleStart, cycle_end: cycleEnd },
        now,
        actorFingerprint,
        { includeLeaderboard: options.includeLeaderboard !== false },
      );

      await client.query('COMMIT');
      return board;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async ensureCycle(client, location, cycleStart, cycleEnd) {
    const cycleStartIso = cycleStart.toISOString();
    const cycleEndIso = cycleEnd.toISOString();
    const existingCycle = await this.getCycleByStart(client, location, cycleStart);

    if (existingCycle) {
      return existingCycle;
    }

    const previousCycle = await this.getPreviousCycle(client, location, cycleStart);
    await this.archiveConfirmedTilesForCycle(client, location, previousCycle);

    const insertedCycleResult = await client.query(`
      INSERT INTO feebas_cycles (location, cycle_start, cycle_end)
      VALUES ($1, $2, $3)
      ON CONFLICT (location, cycle_start) DO NOTHING
      RETURNING *
    `, [location, cycleStartIso, cycleEndIso]);

    if (insertedCycleResult.rows[0]) {
      return insertedCycleResult.rows[0];
    }

    const concurrentCycleResult = await client.query(`
      SELECT *
      FROM feebas_cycles
      WHERE location = $1 AND cycle_start = $2
      LIMIT 1
    `, [location, cycleStartIso]);

    return concurrentCycleResult.rows[0];
  }

  static async getCycleByStart(client, location, cycleStart) {
    const cycleStartIso = cycleStart instanceof Date ? cycleStart.toISOString() : new Date(cycleStart).toISOString();
    const result = await client.query(`
      SELECT *
      FROM feebas_cycles
      WHERE location = $1 AND cycle_start = $2
      LIMIT 1
    `, [location, cycleStartIso]);

    return result.rows[0] || null;
  }

  static async getPreviousCycle(client, location, cycleStart) {
    const cycleStartIso = cycleStart instanceof Date ? cycleStart.toISOString() : new Date(cycleStart).toISOString();
    const result = await client.query(`
      SELECT *
      FROM feebas_cycles
      WHERE location = $1 AND cycle_start < $2
      ORDER BY cycle_start DESC
      LIMIT 1
    `, [location, cycleStartIso]);

    return result.rows[0] || null;
  }

  static async archiveConfirmedTilesForCycle(client, location, cycle, now = new Date()) {
    if (!cycle?.id) {
      return;
    }

    const snapshotResult = await client.query(`
      SELECT tile_id, COUNT(*)::INT AS confirmed_vote_count
      FROM feebas_tile_votes
      WHERE cycle_id = $1 AND status = 'confirmed'
      GROUP BY tile_id
    `, [cycle.id]);

    if (snapshotResult.rows.length === 0) {
      return;
    }

    const locationConfig = getLocationConfig(location);
    const tileLabels = new Map(locationConfig.tiles.map((tile) => [tile.tileId, tile.label]));

    await Promise.all(snapshotResult.rows.map((row) => client.query(`
      INSERT INTO feebas_confirmed_tile_snapshots (
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
      ON CONFLICT (source_cycle_id, tile_id) DO NOTHING
    `, [
      location,
      cycle.id,
      new Date(cycle.cycle_start).toISOString(),
      new Date(cycle.cycle_end).toISOString(),
      row.tile_id,
      tileLabels.get(row.tile_id) || row.tile_id,
      Number(row.confirmed_vote_count) || 0,
      now.toISOString(),
    ])));
  }

  static async getTileVotesForUpdate(client, cycleId, tileId) {
    const result = await client.query(`
      SELECT *
      FROM feebas_tile_votes
      WHERE cycle_id = $1 AND tile_id = $2
      FOR UPDATE
    `, [cycleId, tileId]);

    return result.rows;
  }

  static async applyTileVote(client, cycleId, tileId, { currentVote, pendingVote, actorFingerprint, actorName, nextStatus, now }) {
    if (nextStatus === 'unchecked') {
      if (!currentVote) {
        return;
      }

      await client.query(`
        DELETE FROM feebas_tile_votes
        WHERE id = $1
      `, [currentVote.id]);
      return;
    }

    if (pendingVote && pendingVote.actor_fingerprint !== actorFingerprint && ['checked', 'confirmed'].includes(nextStatus)) {
      await client.query(`
        DELETE FROM feebas_tile_votes
        WHERE id = $1
      `, [pendingVote.id]);
    }

    if (currentVote) {
      await client.query(`
        UPDATE feebas_tile_votes
        SET status = $2,
            actor_name = $3,
            updated_at = $4
        WHERE id = $1
      `, [currentVote.id, nextStatus, actorName, now.toISOString()]);
      return;
    }

    await client.query(`
      INSERT INTO feebas_tile_votes (
        cycle_id,
        tile_id,
        actor_fingerprint,
        actor_name,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $6)
    `, [cycleId, tileId, actorFingerprint, actorName, nextStatus, now.toISOString()]);
  }

  static async insertActivityLog(client, {
    cycleId,
    location,
    tileDefinition,
    previousStatus,
    nextStatus,
    actorName,
    actorFingerprint,
    now,
  }) {
    const actionType = this.getActionType(previousStatus, nextStatus);

    await client.query(`
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      now.toISOString(),
    ]);
  }

  static getActionType(previousStatus, nextStatus) {
    if (nextStatus === 'unchecked') {
      return 'cleared_vote';
    }

    if (!previousStatus) {
      return 'voted';
    }

    return 'changed_vote';
  }

  static getDominantStatus(voteCounts) {
    const ranked = [...FEEBAS_VOTABLE_STATUSES].sort((left, right) => {
      const countDiff = voteCounts[right] - voteCounts[left];
      if (countDiff !== 0) {
        return countDiff;
      }

      return FEEBAS_VOTABLE_STATUSES.indexOf(right) - FEEBAS_VOTABLE_STATUSES.indexOf(left);
    });

    return voteCounts[ranked[0]] > 0 ? ranked[0] : 'unchecked';
  }

  static async getLeaderboard(location, options = {}) {
    getLocationConfig(location);

    const client = options.client || pool;
    const now = options.now ? new Date(options.now) : new Date();
    const weeklySince = options.weeklySince
      ? new Date(options.weeklySince)
      : new Date(now.getTime() - LEADERBOARD_WEEK_MS);
    const limit = normalizeLeaderboardLimit(options.limit);
    const sortBy = normalizeLeaderboardSortBy(options.sortBy);
    const sortDirection = normalizeLeaderboardSortDirection(options.sortDirection);
    const currentUserId = options.currentUserId ? String(options.currentUserId) : null;
    const queryParams = [location, weeklySince.toISOString()];

    const leaderboardResult = await client.query(`
      WITH all_activity AS (
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
        WHERE logs.location = $1
      ),
      logged_activity AS (
        SELECT
          all_activity.*,
          users.id AS user_id,
          users.ign
        FROM all_activity
        JOIN app_users users ON all_activity.actor_fingerprint = CONCAT('account-', users.id::TEXT)
      ),
      pending_reports AS (
        SELECT
          location,
          cycle_id,
          tile_id,
          user_id,
          ign,
          MIN(created_at) AS reported_at
        FROM logged_activity
        WHERE next_status = 'pending'
        GROUP BY location, cycle_id, tile_id, user_id, ign
      ),
      confirmed_tiles AS (
        SELECT
          location,
          cycle_id,
          tile_id,
          MIN(created_at) AS first_confirmed_at
        FROM all_activity
        WHERE next_status = 'confirmed'
        GROUP BY location, cycle_id, tile_id
      ),
      resolved_pending_reports AS (
        SELECT
          reports.location,
          reports.cycle_id,
          reports.tile_id,
          reports.user_id,
          reports.ign,
          reports.reported_at,
          resolution.resolved_status,
          resolution.resolved_at
        FROM pending_reports reports
        JOIN LATERAL (
          SELECT
            activity.next_status AS resolved_status,
            activity.created_at AS resolved_at
          FROM all_activity activity
          WHERE activity.location = reports.location
            AND activity.cycle_id = reports.cycle_id
            AND activity.tile_id = reports.tile_id
            AND activity.created_at > reports.reported_at
            AND activity.next_status IN ('checked', 'confirmed')
          ORDER BY activity.created_at ASC, activity.id ASC
          LIMIT 1
        ) resolution ON true
      ),
      active_users_by_cycle AS (
        SELECT
          cycle_id,
          COUNT(DISTINCT user_id)::INT AS active_user_count
        FROM logged_activity
        GROUP BY cycle_id
      ),
      first_reports AS (
        SELECT DISTINCT ON (location, cycle_id, tile_id)
          location,
          cycle_id,
          tile_id,
          user_id,
          ign,
          reported_at
        FROM pending_reports
        ORDER BY location, cycle_id, tile_id, reported_at ASC, user_id ASC
      ),
      verified_discoveries AS (
        SELECT
          reports.location,
          reports.cycle_id,
          reports.tile_id,
          reports.user_id,
          reports.ign,
          reports.reported_at,
          cycles.cycle_start,
          cycles.cycle_end,
          confirmed_tiles.first_confirmed_at,
          COALESCE(active_users_by_cycle.active_user_count, 1) AS active_user_count,
          (
            GREATEST(EXTRACT(EPOCH FROM (cycles.cycle_end - reports.reported_at)), 0)
            / 60
            * COALESCE(active_users_by_cycle.active_user_count, 1)
          ) AS uptime_minutes
        FROM first_reports reports
        JOIN confirmed_tiles
          ON confirmed_tiles.location = reports.location
         AND confirmed_tiles.cycle_id = reports.cycle_id
         AND confirmed_tiles.tile_id = reports.tile_id
        JOIN feebas_cycles cycles ON cycles.id = reports.cycle_id
        LEFT JOIN active_users_by_cycle ON active_users_by_cycle.cycle_id = reports.cycle_id
      ),
      discovery_check_counts AS (
        SELECT
          discoveries.user_id,
          discoveries.location,
          discoveries.cycle_id,
          discoveries.tile_id,
          COUNT(DISTINCT activity.tile_id)::INT AS checks_to_find
        FROM verified_discoveries discoveries
        LEFT JOIN logged_activity activity
          ON activity.user_id = discoveries.user_id
         AND activity.cycle_id = discoveries.cycle_id
         AND activity.created_at <= discoveries.reported_at
         AND activity.next_status IN ('checked', 'pending')
        GROUP BY discoveries.user_id, discoveries.location, discoveries.cycle_id, discoveries.tile_id
      ),
      discovery_stats AS (
        SELECT
          user_id,
          COUNT(*)::INT AS verified_discoveries,
          COALESCE(SUM(uptime_minutes), 0) AS feebas_uptime_created_minutes,
          (COUNT(*) FILTER (WHERE reported_at >= $2))::INT AS weekly_verified_discoveries,
          COALESCE(SUM(uptime_minutes) FILTER (WHERE reported_at >= $2), 0) AS weekly_feebas_uptime_created_minutes,
          MIN(EXTRACT(EPOCH FROM (reported_at - cycle_start)))::INT AS fastest_find_seconds
        FROM verified_discoveries
        GROUP BY user_id
      ),
      report_stats AS (
        SELECT
          reports.user_id,
          COUNT(*)::INT AS pending_reports,
          (COUNT(*) FILTER (WHERE reports.resolved_status = 'confirmed'))::INT AS verified_reports,
          (COUNT(*) FILTER (WHERE reports.reported_at >= $2))::INT AS weekly_pending_reports,
          (COUNT(*) FILTER (
            WHERE reports.reported_at >= $2
              AND reports.resolved_status = 'confirmed'
          ))::INT AS weekly_verified_reports
        FROM resolved_pending_reports reports
        GROUP BY reports.user_id
      ),
      activity_stats AS (
        SELECT
          user_id,
          ign,
          MIN(GREATEST(EXTRACT(EPOCH FROM (created_at - cycle_start)), 0))::INT AS early_scout_seconds,
          (COUNT(DISTINCT (cycle_id, tile_id)) FILTER (
            WHERE next_status IN ('checked', 'pending')
          ))::INT AS search_coverage,
          (COUNT(DISTINCT (cycle_id, tile_id)) FILTER (
            WHERE next_status = 'confirmed'
          ))::INT AS confirmations,
          (COUNT(DISTINCT (cycle_id, tile_id)) FILTER (
            WHERE next_status IN ('checked', 'pending')
              AND created_at >= $2
          ))::INT AS weekly_search_coverage,
          (COUNT(DISTINCT (cycle_id, tile_id)) FILTER (
            WHERE next_status = 'confirmed'
              AND created_at >= $2
          ))::INT AS weekly_confirmations
        FROM logged_activity
        GROUP BY user_id, ign
      ),
      persistence_stats AS (
        SELECT
          user_id,
          MAX(checks_to_find)::INT AS most_persistent_checks
        FROM discovery_check_counts
        GROUP BY user_id
      ),
      combined AS (
        SELECT
          activity_stats.user_id,
          activity_stats.ign,
          COALESCE(discovery_stats.verified_discoveries, 0) AS verified_discoveries,
          COALESCE(discovery_stats.feebas_uptime_created_minutes, 0) AS feebas_uptime_created_minutes,
          COALESCE(discovery_stats.weekly_verified_discoveries, 0) AS weekly_verified_discoveries,
          COALESCE(discovery_stats.weekly_feebas_uptime_created_minutes, 0) AS weekly_feebas_uptime_created_minutes,
          COALESCE(discovery_stats.fastest_find_seconds, 0) AS fastest_find_seconds,
          COALESCE(activity_stats.early_scout_seconds, 0) AS early_scout_seconds,
          COALESCE(activity_stats.confirmations, 0) AS confirmations,
          COALESCE(activity_stats.search_coverage, 0) AS search_coverage,
          COALESCE(activity_stats.weekly_confirmations, 0) AS weekly_confirmations,
          COALESCE(activity_stats.weekly_search_coverage, 0) AS weekly_search_coverage,
          COALESCE(report_stats.pending_reports, 0) AS pending_reports,
          COALESCE(report_stats.verified_reports, 0) AS verified_reports,
          COALESCE(report_stats.weekly_pending_reports, 0) AS weekly_pending_reports,
          COALESCE(report_stats.weekly_verified_reports, 0) AS weekly_verified_reports,
          COALESCE(persistence_stats.most_persistent_checks, 0) AS most_persistent_checks
        FROM activity_stats
        LEFT JOIN discovery_stats ON discovery_stats.user_id = activity_stats.user_id
        LEFT JOIN report_stats ON report_stats.user_id = activity_stats.user_id
        LEFT JOIN persistence_stats ON persistence_stats.user_id = activity_stats.user_id
      ),
      scored AS (
        SELECT
          *,
          CASE
            WHEN search_coverage > 0 THEN verified_discoveries::NUMERIC / search_coverage
            ELSE 0
          END AS efficiency,
          CASE
            WHEN pending_reports > 0 THEN verified_reports::NUMERIC / pending_reports
            ELSE 0
          END AS report_accuracy,
          (
            verified_discoveries * 100
            + (feebas_uptime_created_minutes / 60)
            + confirmations * 25
            + search_coverage * 2
          ) AS all_time_contribution_score,
          (
            weekly_verified_discoveries * 100
            + (weekly_feebas_uptime_created_minutes / 60)
            + weekly_confirmations * 25
            + weekly_search_coverage * 2
          ) AS weekly_contribution_score
        FROM combined
      )
      SELECT *
      FROM scored
      ORDER BY
        all_time_contribution_score DESC,
        verified_discoveries DESC,
        feebas_uptime_created_minutes DESC,
        confirmations DESC,
        search_coverage DESC,
        ign ASC
    `, queryParams);

    const streakResult = await client.query(`
      WITH logged_activity AS (
        SELECT
          logs.cycle_id,
          users.id AS user_id,
          cycles.cycle_start
        FROM feebas_activity_logs logs
        JOIN feebas_cycles cycles ON cycles.id = logs.cycle_id
        JOIN app_users users ON logs.actor_fingerprint = CONCAT('account-', users.id::TEXT)
        WHERE logs.location = $1
      )
      SELECT user_id, cycle_id, cycle_start
      FROM logged_activity
      GROUP BY user_id, cycle_id, cycle_start
      ORDER BY cycle_start DESC, cycle_id DESC
    `, [location]);

    const streaksByUser = buildCurrentStreaks(streakResult.rows);

    const entries = leaderboardResult.rows.map((row) => ({
      userId: row.user_id,
      ign: row.ign,
      verifiedDiscoveries: toFiniteNumber(row.verified_discoveries),
      feebasUptimeCreatedMinutes: toFiniteNumber(row.feebas_uptime_created_minutes),
      confirmations: toFiniteNumber(row.confirmations),
      searchCoverage: toFiniteNumber(row.search_coverage),
      weeklyContributionScore: toFiniteNumber(row.weekly_contribution_score),
      allTimeContributionScore: toFiniteNumber(row.all_time_contribution_score),
      fastestFindSeconds: toFiniteNumber(row.fastest_find_seconds, null),
      earlyScoutSeconds: toFiniteNumber(row.early_scout_seconds, null),
      efficiency: toFiniteNumber(row.efficiency),
      reportAccuracy: toFiniteNumber(row.report_accuracy),
      currentStreak: streaksByUser.get(String(row.user_id)) || 0,
      mostPersistentChecks: toFiniteNumber(row.most_persistent_checks, null),
      pendingReports: toFiniteNumber(row.pending_reports),
      verifiedReports: toFiniteNumber(row.verified_reports),
    }));
    const rankedEntries = sortLeaderboardEntries(entries, sortBy, sortDirection)
      .map((entry, index) => ({
        rank: index + 1,
        ...entry,
      }));
    const limitedEntries = rankedEntries.slice(0, limit);
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
      sortOptions: this.getLeaderboardSortOptions(),
      entries: sortedEntries,
    };
  }

  static async getBoardForCycle(client, location, cycle, now = new Date(), actorFingerprint = null, options = {}) {
    const locationConfig = getLocationConfig(location);
    const includeLeaderboard = options.includeLeaderboard !== false;
    const votesResult = await client.query(`
      SELECT tile_id, actor_fingerprint, actor_name, status
      FROM feebas_tile_votes
      WHERE cycle_id = $1
    `, [cycle.id]);
    const previousConfirmedTilesResult = await client.query(`
      SELECT tile_id, SUM(confirmed_vote_count)::INT AS confirmations
      FROM feebas_confirmed_tile_snapshots
      WHERE location = $1
      GROUP BY tile_id
    `, [location]);
    const activityResult = await client.query(`
      SELECT *
      FROM feebas_activity_logs
      WHERE cycle_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 20
    `, [cycle.id]);
    const leaderboard = includeLeaderboard
      ? await this.getLeaderboard(location, { client, now, currentUserId: options.currentUserId })
      : undefined;

    const votesByTile = votesResult.rows.reduce((map, row) => {
      const existing = map.get(row.tile_id) || [];
      existing.push(row);
      map.set(row.tile_id, existing);
      return map;
    }, new Map());

    return {
      location: locationConfig.id,
      displayName: locationConfig.displayName,
      description: locationConfig.description,
      cycleStart: new Date(cycle.cycle_start).toISOString(),
      cycleEnd: new Date(cycle.cycle_end).toISOString(),
      serverTime: now.toISOString(),
      resetIntervalMinutes: 45,
      requiresDistinctConfirmation: false,
      confirmedTileId: null,
      isLocked: false,
      previousConfirmedTiles: previousConfirmedTilesResult.rows.map((entry) => ({
        tileId: entry.tile_id,
        confirmations: Number(entry.confirmations) || 0,
      })),
      layout: {
        rows: locationConfig.rows,
        cols: locationConfig.cols,
      },
      activity: activityResult.rows.map((entry) => ({
        id: entry.id,
        tileId: entry.tile_id,
        tileLabel: entry.tile_label,
        actionType: entry.action_type,
        previousStatus: entry.previous_status,
        nextStatus: entry.next_status === 'unchecked' ? null : entry.next_status,
        actorName: getActivityActorName(entry),
        createdAt: new Date(entry.created_at).toISOString(),
      })),
      ...(includeLeaderboard ? { leaderboard } : {}),
      tiles: locationConfig.tiles.map((tileDefinition) => {
        const tileVotes = votesByTile.get(tileDefinition.tileId) || [];
        const voteCounts = {
          checked: tileVotes.filter((vote) => vote.status === 'checked').length,
          pending: tileVotes.filter((vote) => vote.status === 'pending').length,
          confirmed: tileVotes.filter((vote) => vote.status === 'confirmed').length,
        };
        const currentUserVote = actorFingerprint
          ? tileVotes.find((vote) => vote.actor_fingerprint === actorFingerprint)?.status || 'unchecked'
          : 'unchecked';

        return {
          ...tileDefinition,
          status: this.getDominantStatus(voteCounts),
          voteCounts,
          totalVotes: voteCounts.checked + voteCounts.pending + voteCounts.confirmed,
          currentUserVote,
        };
      }),
    };
  }
}

module.exports = FeebasBoard;
