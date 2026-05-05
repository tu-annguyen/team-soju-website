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

class FeebasBoard {
  static async getBoard(location, options = {}) {
    const client = options.client || pool;
    const now = options.now ? new Date(options.now) : new Date();
    const actorFingerprint = sanitizeFingerprint(options.actorFingerprint);
    const { cycleStart, cycleEnd } = getCycleWindow(now);

    const cycle = await this.ensureCycle(client, location, cycleStart, cycleEnd);
    return this.getBoardForCycle(client, location, cycle, now, actorFingerprint);
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

  static async getBoardForCycle(client, location, cycle, now = new Date(), actorFingerprint = null) {
    const locationConfig = getLocationConfig(location);
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
        actorName: entry.actor_name,
        createdAt: new Date(entry.created_at).toISOString(),
      })),
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
