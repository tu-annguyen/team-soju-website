#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');
const dotenv = require('dotenv');
const { convertPostgresExportToD1Sql } = require('./postgresToD1');

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1082, (value) => value);
types.setTypeParser(1114, (value) => new Date(`${value}Z`).toISOString());
types.setTypeParser(1184, (value) => new Date(value).toISOString());

const TABLE_EXPORTS = [
  {
    key: 'members',
    table: 'team_members',
    orderBy: 'ign ASC',
    columns: [
      'id',
      'ign',
      'discord_id',
      'rank',
      'notes',
      'join_date',
      'is_active',
    ],
  },
  {
    key: 'shinies',
    table: 'team_shinies',
    orderBy: 'created_at ASC, pokemon ASC, id ASC',
    columns: [
      'id',
      'pokemon',
      'variants',
      'national_number',
      'original_trainer',
      'catch_date',
      'total_encounters',
      'species_encounters',
      'encounter_type',
      'location',
      'nature',
      'iv_hp',
      'iv_attack',
      'iv_defense',
      'iv_sp_attack',
      'iv_sp_defense',
      'iv_speed',
      'is_secret',
      'is_alpha',
      'screenshot_url',
      'status',
      'notes',
      'created_at',
    ],
  },
  {
    key: 'users',
    table: 'app_users',
    orderBy: 'created_at ASC, id ASC',
    columns: [
      'id',
      'email',
      'password_hash',
      'ign',
      'discord_id',
      'discord_username',
      'discord_global_name',
      'discord_avatar',
      'auth_provider',
      'password_reset_token_hash',
      'password_reset_expires_at',
      'password_reset_requested_at',
      'created_at',
      'updated_at',
      'last_login_at',
    ],
  },
  {
    key: 'feebasCycles',
    table: 'feebas_cycles',
    orderBy: 'id ASC',
    columns: [
      'id',
      'location',
      'cycle_start',
      'cycle_end',
      'confirmed_tile_id',
      'locked_at',
      'created_at',
    ],
  },
  {
    key: 'feebasTileStates',
    table: 'feebas_tile_states',
    orderBy: 'id ASC',
    columns: [
      'id',
      'cycle_id',
      'tile_id',
      'status',
      'updated_at',
      'updated_by_name',
      'updated_by_fingerprint',
      'pending_reported_by_name',
      'pending_reported_by_fingerprint',
      'confirmed_by_name',
      'confirmed_by_fingerprint',
      'confirmed_at',
    ],
  },
  {
    key: 'feebasTileVotes',
    table: 'feebas_tile_votes',
    orderBy: 'id ASC',
    columns: [
      'id',
      'cycle_id',
      'tile_id',
      'actor_fingerprint',
      'actor_name',
      'status',
      'created_at',
      'updated_at',
    ],
  },
  {
    key: 'feebasActivityLogs',
    table: 'feebas_activity_logs',
    orderBy: 'id ASC',
    columns: [
      'id',
      'cycle_id',
      'location',
      'tile_id',
      'tile_label',
      'action_type',
      'previous_status',
      'next_status',
      'actor_name',
      'actor_fingerprint',
      'created_at',
    ],
  },
  {
    key: 'feebasConfirmedTileSnapshots',
    table: 'feebas_confirmed_tile_snapshots',
    orderBy: 'id ASC',
    columns: [
      'id',
      'location',
      'source_cycle_id',
      'cycle_start',
      'cycle_end',
      'tile_id',
      'tile_label',
      'confirmed_vote_count',
      'archived_at',
    ],
  },
];

function printHelp() {
  process.stderr.write(`Usage: node src/scripts/export-postgres-to-d1.js [options]

Options:
  --out <file>   Write SQL to a file instead of stdout.
  --wipe         Include DELETE statements before INSERTs for replacing staging data.
  --help         Show this message.

Connection env:
  DATABASE_URL is preferred. DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD are also supported.
`);
}

function parseArgs(argv) {
  const args = {
    out: null,
    includeWipe: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }

    if (arg === '--wipe') {
      args.includeWipe = true;
      continue;
    }

    if (arg === '--out') {
      const outputPath = argv[index + 1];
      if (!outputPath || outputPath.startsWith('--')) {
        throw new Error('--out requires a file path.');
      }

      args.out = outputPath;
      index += 1;
      continue;
    }

    if (arg.startsWith('--out=')) {
      args.out = arg.slice('--out='.length);
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (args.out === '') {
    throw new Error('--out requires a file path.');
  }

  return args;
}

function shouldUseSsl() {
  const explicitSsl = (process.env.DB_SSL || '').trim().toLowerCase();
  const sslMode = (process.env.PGSSLMODE || process.env.DB_SSL_MODE || '').trim().toLowerCase();
  const databaseUrl = process.env.DATABASE_URL || '';

  if (['1', 'true', 'yes', 'require', 'required'].includes(explicitSsl)) return true;
  if (['require', 'prefer', 'verify-ca', 'verify-full'].includes(sslMode)) return true;
  if (/sslmode=(require|prefer|verify-ca|verify-full)/i.test(databaseUrl)) return true;

  return process.env.NODE_ENV === 'production';
}

function buildPoolConfig() {
  const ssl = shouldUseSsl() ? { rejectUnauthorized: false } : false;
  const databaseUrl = (process.env.DATABASE_URL || '').trim();

  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      ssl,
    };
  }

  return {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl,
  };
}

async function tableExists(pool, tableName) {
  const result = await pool.query('SELECT to_regclass($1) IS NOT NULL AS exists', [`public.${tableName}`]);
  return Boolean(result.rows[0]?.exists);
}

async function fetchTable(pool, exportConfig) {
  if (!(await tableExists(pool, exportConfig.table))) {
    process.stderr.write(`Skipping missing table ${exportConfig.table}\n`);
    return [];
  }

  const result = await pool.query(
    `SELECT ${exportConfig.columns.join(', ')} FROM ${exportConfig.table} ORDER BY ${exportConfig.orderBy}`
  );

  return result.rows;
}

function getCounts(exportData) {
  return Object.fromEntries(
    Object.entries(exportData).map(([key, rows]) => [key, rows.length])
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const pool = new Pool(buildPoolConfig());

  try {
    const exportData = {};

    for (const exportConfig of TABLE_EXPORTS) {
      exportData[exportConfig.key] = await fetchTable(pool, exportConfig);
    }

    const sql = convertPostgresExportToD1Sql(exportData, {
      includeWipe: args.includeWipe,
    });

    if (args.out) {
      fs.writeFileSync(args.out, `${sql}\n`);
      process.stderr.write(`Wrote D1 import SQL to ${args.out}\n`);
    } else {
      process.stdout.write(`${sql}\n`);
    }

    process.stderr.write(`Exported ${JSON.stringify(getCounts(exportData))}\n`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
