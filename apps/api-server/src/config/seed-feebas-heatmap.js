const pool = require('./connection');
const { getLocationConfig } = require('../utils/feebas');

const DEMO_SOURCE_CYCLE_START = 900000000;

const DEMO_HISTORY = {
  'route-119-main': [
    { tileId: 'r9c7', confirmations: [3, 2, 2, 1, 1, 1] },
    { tileId: 'r9c8', confirmations: [3, 3, 2, 2, 1] },
    { tileId: 'r9c9', confirmations: [3, 3, 3, 2, 2, 1] },
    { tileId: 'r10c8', confirmations: [3, 2, 2, 1] },
    { tileId: 'r10c9', confirmations: [3, 3, 2, 2, 2, 1] },
    { tileId: 'r10c10', confirmations: [3, 3, 3, 2, 1] },
    { tileId: 'r11c8', confirmations: [2, 2, 1, 1] },
    { tileId: 'r11c9', confirmations: [3, 2, 2, 2, 1] },
    { tileId: 'r11c10', confirmations: [2, 2, 2, 1] },
    { tileId: 'r12c9', confirmations: [2, 1, 1] },
    { tileId: 'r12c10', confirmations: [2, 2, 1] },
    { tileId: 'r8c10', confirmations: [1, 1] },
    { tileId: 'r8c11', confirmations: [2, 1] },
    { tileId: 'r13c8', confirmations: [1] },
    { tileId: 'r13c9', confirmations: [1, 1] },
    { tileId: 'r7c12', confirmations: [1] },
  ],
  'mt-coronet': [
    { tileId: 'r7c8', confirmations: [2, 1, 1] },
    { tileId: 'r7c9', confirmations: [3, 2, 2, 1] },
    { tileId: 'r7c10', confirmations: [3, 3, 2, 2, 1] },
    { tileId: 'r8c8', confirmations: [2, 2, 1] },
    { tileId: 'r8c9', confirmations: [3, 3, 2, 2, 1] },
    { tileId: 'r8c10', confirmations: [3, 3, 3, 2, 1] },
    { tileId: 'r9c8', confirmations: [2, 1, 1] },
    { tileId: 'r9c9', confirmations: [3, 2, 2, 1] },
    { tileId: 'r9c10', confirmations: [2, 2, 1] },
    { tileId: 'r10c9', confirmations: [2, 1] },
    { tileId: 'r10c10', confirmations: [2, 2, 1] },
    { tileId: 'r11c9', confirmations: [1, 1] },
    { tileId: 'r11c10', confirmations: [1] },
    { tileId: 'r6c10', confirmations: [1] },
  ],
};

function buildSnapshotRows(location, startingCycleId) {
  const locationConfig = getLocationConfig(location);
  const tileLabels = new Map(locationConfig.tiles.map((tile) => [tile.tileId, tile.label]));
  let sourceCycleId = startingCycleId;

  return DEMO_HISTORY[location].flatMap((entry) =>
    entry.confirmations.map((confirmedVoteCount, index) => {
      const cycleStart = new Date(Date.UTC(2026, 3, 1, 0, 0, 0) + ((sourceCycleId - startingCycleId) * 45 * 60 * 1000));
      const cycleEnd = new Date(cycleStart.getTime() + (45 * 60 * 1000));
      const archivedAt = new Date(cycleEnd.getTime() + (index * 60 * 1000));

      return {
        location,
        sourceCycleId: sourceCycleId++,
        cycleStart: cycleStart.toISOString(),
        cycleEnd: cycleEnd.toISOString(),
        tileId: entry.tileId,
        tileLabel: tileLabels.get(entry.tileId) || entry.tileId,
        confirmedVoteCount,
        archivedAt: archivedAt.toISOString(),
      };
    })
  );
}

async function seedFeebasHeatmap() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      DELETE FROM feebas_confirmed_tile_snapshots
      WHERE source_cycle_id >= $1
    `, [DEMO_SOURCE_CYCLE_START]);

    const rows = [
      ...buildSnapshotRows('route-119-main', DEMO_SOURCE_CYCLE_START),
      ...buildSnapshotRows('mt-coronet', DEMO_SOURCE_CYCLE_START + 5000),
    ];

    for (const row of rows) {
      await client.query(`
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
      `, [
        row.location,
        row.sourceCycleId,
        row.cycleStart,
        row.cycleEnd,
        row.tileId,
        row.tileLabel,
        row.confirmedVoteCount,
        row.archivedAt,
      ]);
    }

    await client.query('COMMIT');
    console.log(`Inserted ${rows.length} demo Feebas snapshot rows.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to seed Feebas heatmap demo data:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedFeebasHeatmap();
