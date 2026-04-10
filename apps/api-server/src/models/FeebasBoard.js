const pool = require('../config/connection');
const {
  FeebasRuleError,
  getCycleWindow,
  getLocationConfig,
  sanitizeActorName,
  sanitizeFingerprint,
  validateStatus,
  validateTransition,
} = require('../utils/feebas');

class FeebasBoard {
  static async getBoard(location, options = {}) {
    const client = options.client || pool;
    const now = options.now ? new Date(options.now) : new Date();
    const { cycleStart, cycleEnd } = getCycleWindow(now);

    const cycle = await this.ensureCycle(client, location, cycleStart, cycleEnd);
    return this.getBoardForCycle(client, location, cycle, now);
  }

  static async resetBoard(location, options = {}) {
    const now = options.now ? new Date(options.now) : new Date();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      getLocationConfig(location);
      const { cycleStart } = getCycleWindow(now);

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
      const lockedCycle = await this.getCycleById(client, cycle.id, true);

      const tile = await this.getTileForUpdate(client, cycle.id, tileId);
      validateTransition(tile.status, nextStatus);

      if (nextStatus === 'confirmed') {
        if (tile.status !== 'pending') {
          throw new FeebasRuleError('Only pending tiles can be confirmed');
        }

        if (!tile.pending_reported_by_fingerprint) {
          throw new FeebasRuleError('Pending tiles must record the original reporter');
        }

        if (tile.pending_reported_by_fingerprint === actorFingerprint) {
          throw new FeebasRuleError('A second distinct user must confirm a pending Feebas tile');
        }

        if (lockedCycle.confirmed_tile_id && lockedCycle.confirmed_tile_id !== tileId) {
          throw new FeebasRuleError('Reset the currently confirmed tile before confirming a different one');
        }
      }

      await this.applyTileUpdate(client, cycle.id, tile, {
        actorFingerprint,
        actorName,
        nextStatus,
        now,
      });

      await this.insertActivityLog(client, {
        cycleId: cycle.id,
        location,
        tileDefinition,
        previousStatus: tile.status,
        nextStatus,
        actorName,
        actorFingerprint,
        now,
      });

      if (nextStatus === 'confirmed') {
        await client.query(`
          UPDATE feebas_cycles
          SET confirmed_tile_id = $2,
              locked_at = NULL
          WHERE id = $1
        `, [cycle.id, tileId]);
      } else if (tile.status === 'confirmed') {
        await client.query(`
          UPDATE feebas_cycles
          SET confirmed_tile_id = NULL,
              locked_at = NULL
          WHERE id = $1
        `, [cycle.id]);
      }

      const board = await this.getBoardForCycle(client, location, { ...cycle, cycle_start: cycleStart, cycle_end: cycleEnd }, now);

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
    const result = await client.query(`
      INSERT INTO feebas_cycles (location, cycle_start, cycle_end)
      VALUES ($1, $2, $3)
      ON CONFLICT (location, cycle_start)
      DO UPDATE SET cycle_end = EXCLUDED.cycle_end
      RETURNING *
    `, [location, cycleStart.toISOString(), cycleEnd.toISOString()]);

    const cycle = result.rows[0];
    const locationConfig = getLocationConfig(location);

    await Promise.all(locationConfig.tiles.map((tile) =>
      client.query(`
        INSERT INTO feebas_tile_states (cycle_id, tile_id, status)
        VALUES ($1, $2, 'unchecked')
        ON CONFLICT (cycle_id, tile_id) DO NOTHING
      `, [cycle.id, tile.tileId])
    ));

    return cycle;
  }

  static async getCycleById(client, cycleId, forUpdate = false) {
    const lockClause = forUpdate ? 'FOR UPDATE' : '';
    const result = await client.query(`
      SELECT *
      FROM feebas_cycles
      WHERE id = $1
      ${lockClause}
    `, [cycleId]);

    return result.rows[0];
  }

  static async getTileForUpdate(client, cycleId, tileId) {
    const result = await client.query(`
      SELECT *
      FROM feebas_tile_states
      WHERE cycle_id = $1 AND tile_id = $2
      FOR UPDATE
    `, [cycleId, tileId]);

    if (!result.rows[0]) {
      throw new FeebasRuleError('Feebas tile state not found', 404);
    }

    return result.rows[0];
  }

  static async applyTileUpdate(client, cycleId, tile, { actorFingerprint, actorName, nextStatus, now }) {
    const baseValues = [
      cycleId,
      tile.tile_id,
      nextStatus,
      now.toISOString(),
      actorName,
      actorFingerprint,
    ];

    if (nextStatus === 'pending') {
      await client.query(`
        UPDATE feebas_tile_states
        SET status = $3,
            updated_at = $4,
            updated_by_name = $5,
            updated_by_fingerprint = $6,
            pending_reported_by_name = $5,
            pending_reported_by_fingerprint = $6,
            confirmed_by_name = NULL,
            confirmed_by_fingerprint = NULL,
            confirmed_at = NULL
        WHERE cycle_id = $1 AND tile_id = $2
      `, baseValues);
      return;
    }

    if (nextStatus === 'confirmed') {
      await client.query(`
        UPDATE feebas_tile_states
        SET status = $3,
            updated_at = $4,
            updated_by_name = $5,
            updated_by_fingerprint = $6,
            confirmed_by_name = $5,
            confirmed_by_fingerprint = $6,
            confirmed_at = $4
        WHERE cycle_id = $1 AND tile_id = $2
      `, baseValues);
      return;
    }

    await client.query(`
      UPDATE feebas_tile_states
      SET status = $3,
          updated_at = $4,
          updated_by_name = $5,
          updated_by_fingerprint = $6,
          pending_reported_by_name = CASE WHEN status = 'pending' THEN NULL ELSE pending_reported_by_name END,
          pending_reported_by_fingerprint = CASE WHEN status = 'pending' THEN NULL ELSE pending_reported_by_fingerprint END,
          confirmed_by_name = NULL,
          confirmed_by_fingerprint = NULL,
          confirmed_at = NULL
      WHERE cycle_id = $1 AND tile_id = $2
    `, baseValues);
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
    if (nextStatus === 'confirmed') {
      return 'confirmed';
    }

    if (nextStatus === 'pending') {
      return 'reported';
    }

    if (nextStatus === 'checked') {
      return previousStatus === 'pending' ? 'reverted_to_checked' : 'checked';
    }

    if (nextStatus === 'unchecked') {
      return previousStatus === 'pending' ? 'cleared_pending' : 'unchecked';
    }

    return 'updated';
  }

  static async getBoardForCycle(client, location, cycle, now = new Date()) {
    const locationConfig = getLocationConfig(location);
    const tilesResult = await client.query(`
      SELECT *
      FROM feebas_tile_states
      WHERE cycle_id = $1
      ORDER BY tile_id ASC
    `, [cycle.id]);
    const activityResult = await client.query(`
      SELECT *
      FROM feebas_activity_logs
      WHERE cycle_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 20
    `, [cycle.id]);

    const tileMap = new Map(tilesResult.rows.map((row) => [row.tile_id, row]));

    return {
      location: locationConfig.id,
      displayName: locationConfig.displayName,
      description: locationConfig.description,
      cycleStart: new Date(cycle.cycle_start).toISOString(),
      cycleEnd: new Date(cycle.cycle_end).toISOString(),
      serverTime: now.toISOString(),
      resetIntervalMinutes: 45,
      requiresDistinctConfirmation: true,
      confirmedTileId: cycle.confirmed_tile_id,
      isLocked: false,
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
        nextStatus: entry.next_status,
        actorName: entry.actor_name,
        createdAt: new Date(entry.created_at).toISOString(),
      })),
      tiles: locationConfig.tiles.map((tileDefinition) => {
        const row = tileMap.get(tileDefinition.tileId);
        return {
          ...tileDefinition,
          status: row?.status || 'unchecked',
          updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
          updatedByName: row?.updated_by_name || null,
          pendingReportedByName: row?.pending_reported_by_name || null,
          pendingReportedByFingerprint: row?.pending_reported_by_fingerprint || null,
          confirmedByName: row?.confirmed_by_name || null,
          confirmedAt: row?.confirmed_at ? new Date(row.confirmed_at).toISOString() : null,
        };
      }),
    };
  }
}

module.exports = FeebasBoard;
