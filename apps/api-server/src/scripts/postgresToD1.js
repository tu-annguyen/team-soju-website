function toSqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function toSqlLiteralOrDefault(value, defaultExpression) {
  if (value === null || value === undefined) return defaultExpression;
  return toSqlLiteral(value);
}

function toDateOnly(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function normalizeBoolean(value) {
  return value ? 1 : 0;
}

function buildD1WipeStatements() {
  return [
    'DELETE FROM feebas_activity_logs;',
    'DELETE FROM feebas_tile_votes;',
    'DELETE FROM feebas_tile_states;',
    'DELETE FROM feebas_confirmed_tile_snapshots;',
    'DELETE FROM feebas_cycles;',
    'DELETE FROM team_shinies;',
    'DELETE FROM team_members;',
    'DELETE FROM app_users;',
    "DELETE FROM sqlite_sequence WHERE name IN ('feebas_cycles', 'feebas_tile_states', 'feebas_tile_votes', 'feebas_activity_logs', 'feebas_confirmed_tile_snapshots');",
  ];
}

function buildMemberInsert(member) {
  return `INSERT INTO team_members (id, ign, discord_id, rank, notes, join_date, is_active) VALUES (${[
    toSqlLiteral(member.id),
    toSqlLiteral(member.ign),
    toSqlLiteral(member.discord_id),
    toSqlLiteral(member.rank || 'Trainer'),
    toSqlLiteral(member.notes),
    toSqlLiteralOrDefault(toDateOnly(member.join_date), "date('now')"),
    normalizeBoolean(member.is_active ?? true),
  ].join(', ')});`;
}

function buildShinyInsert(shiny) {
  return `INSERT INTO team_shinies (
    id, pokemon, variants, national_number, original_trainer, catch_date, total_encounters,
    species_encounters, encounter_type, location, nature, iv_hp, iv_attack, iv_defense,
    iv_sp_attack, iv_sp_defense, iv_speed, is_secret, is_alpha, screenshot_url, status, notes, created_at
  ) VALUES (${[
    toSqlLiteral(shiny.id),
    toSqlLiteral(shiny.pokemon),
    toSqlLiteral(shiny.variants ?? ''),
    toSqlLiteral(shiny.national_number),
    toSqlLiteral(shiny.original_trainer),
    toSqlLiteralOrDefault(toDateOnly(shiny.catch_date || shiny.created_at), "date('now')"),
    toSqlLiteral(shiny.total_encounters ?? 0),
    toSqlLiteral(shiny.species_encounters ?? 0),
    toSqlLiteral(shiny.encounter_type),
    toSqlLiteral(shiny.location),
    toSqlLiteral(shiny.nature),
    toSqlLiteral(shiny.iv_hp),
    toSqlLiteral(shiny.iv_attack),
    toSqlLiteral(shiny.iv_defense),
    toSqlLiteral(shiny.iv_sp_attack),
    toSqlLiteral(shiny.iv_sp_defense),
    toSqlLiteral(shiny.iv_speed),
    normalizeBoolean(shiny.is_secret),
    normalizeBoolean(shiny.is_alpha),
    toSqlLiteral(shiny.screenshot_url),
    toSqlLiteral(shiny.status || 'Owned'),
    toSqlLiteral(shiny.notes),
    toSqlLiteralOrDefault(shiny.created_at, "datetime('now')"),
  ].join(', ')});`;
}

function buildUserInsert(user) {
  return `INSERT INTO app_users (
    id, email, password_hash, ign, discord_id, discord_username, discord_global_name,
    discord_avatar, auth_provider, password_reset_token_hash, password_reset_expires_at,
    password_reset_requested_at, created_at, updated_at, last_login_at
  ) VALUES (${[
    toSqlLiteral(user.id),
    toSqlLiteral(user.email),
    toSqlLiteral(user.password_hash),
    toSqlLiteral(user.ign),
    toSqlLiteral(user.discord_id),
    toSqlLiteral(user.discord_username),
    toSqlLiteral(user.discord_global_name),
    toSqlLiteral(user.discord_avatar),
    toSqlLiteral(user.auth_provider || 'password'),
    toSqlLiteral(user.password_reset_token_hash),
    toSqlLiteral(user.password_reset_expires_at),
    toSqlLiteral(user.password_reset_requested_at),
    toSqlLiteralOrDefault(user.created_at, "datetime('now')"),
    toSqlLiteralOrDefault(user.updated_at, "datetime('now')"),
    toSqlLiteral(user.last_login_at),
  ].join(', ')});`;
}

function buildFeebasCycleInsert(cycle) {
  return `INSERT INTO feebas_cycles (
    id, location, cycle_start, cycle_end, confirmed_tile_id, locked_at, created_at
  ) VALUES (${[
    toSqlLiteral(cycle.id),
    toSqlLiteral(cycle.location),
    toSqlLiteral(cycle.cycle_start),
    toSqlLiteral(cycle.cycle_end),
    toSqlLiteral(cycle.confirmed_tile_id),
    toSqlLiteral(cycle.locked_at),
    toSqlLiteralOrDefault(cycle.created_at, "datetime('now')"),
  ].join(', ')});`;
}

function buildFeebasTileStateInsert(tileState) {
  return `INSERT INTO feebas_tile_states (
    id, cycle_id, tile_id, status, updated_at, updated_by_name, updated_by_fingerprint,
    pending_reported_by_name, pending_reported_by_fingerprint, confirmed_by_name,
    confirmed_by_fingerprint, confirmed_at
  ) VALUES (${[
    toSqlLiteral(tileState.id),
    toSqlLiteral(tileState.cycle_id),
    toSqlLiteral(tileState.tile_id),
    toSqlLiteral(tileState.status || 'unchecked'),
    toSqlLiteralOrDefault(tileState.updated_at, "datetime('now')"),
    toSqlLiteral(tileState.updated_by_name),
    toSqlLiteral(tileState.updated_by_fingerprint),
    toSqlLiteral(tileState.pending_reported_by_name),
    toSqlLiteral(tileState.pending_reported_by_fingerprint),
    toSqlLiteral(tileState.confirmed_by_name),
    toSqlLiteral(tileState.confirmed_by_fingerprint),
    toSqlLiteral(tileState.confirmed_at),
  ].join(', ')});`;
}

function buildFeebasTileVoteInsert(vote) {
  return `INSERT INTO feebas_tile_votes (
    id, cycle_id, tile_id, actor_fingerprint, actor_name, status, created_at, updated_at
  ) VALUES (${[
    toSqlLiteral(vote.id),
    toSqlLiteral(vote.cycle_id),
    toSqlLiteral(vote.tile_id),
    toSqlLiteral(vote.actor_fingerprint),
    toSqlLiteral(vote.actor_name),
    toSqlLiteral(vote.status),
    toSqlLiteralOrDefault(vote.created_at, "datetime('now')"),
    toSqlLiteralOrDefault(vote.updated_at, "datetime('now')"),
  ].join(', ')});`;
}

function buildFeebasActivityLogInsert(log) {
  return `INSERT INTO feebas_activity_logs (
    id, cycle_id, location, tile_id, tile_label, action_type, previous_status,
    next_status, actor_name, actor_fingerprint, created_at
  ) VALUES (${[
    toSqlLiteral(log.id),
    toSqlLiteral(log.cycle_id),
    toSqlLiteral(log.location),
    toSqlLiteral(log.tile_id),
    toSqlLiteral(log.tile_label),
    toSqlLiteral(log.action_type),
    toSqlLiteral(log.previous_status),
    toSqlLiteral(log.next_status),
    toSqlLiteral(log.actor_name),
    toSqlLiteral(log.actor_fingerprint),
    toSqlLiteralOrDefault(log.created_at, "datetime('now')"),
  ].join(', ')});`;
}

function buildFeebasConfirmedTileSnapshotInsert(snapshot) {
  return `INSERT INTO feebas_confirmed_tile_snapshots (
    id, location, source_cycle_id, cycle_start, cycle_end, tile_id, tile_label,
    confirmed_vote_count, archived_at
  ) VALUES (${[
    toSqlLiteral(snapshot.id),
    toSqlLiteral(snapshot.location),
    toSqlLiteral(snapshot.source_cycle_id),
    toSqlLiteral(snapshot.cycle_start),
    toSqlLiteral(snapshot.cycle_end),
    toSqlLiteral(snapshot.tile_id),
    toSqlLiteral(snapshot.tile_label),
    toSqlLiteral(snapshot.confirmed_vote_count ?? 0),
    toSqlLiteralOrDefault(snapshot.archived_at, "datetime('now')"),
  ].join(', ')});`;
}

function convertPostgresExportToD1Sql({
  members = [],
  shinies = [],
  users = [],
  feebasCycles = [],
  feebasTileStates = [],
  feebasTileVotes = [],
  feebasActivityLogs = [],
  feebasConfirmedTileSnapshots = [],
}, options = {}) {
  const { includeWipe = false } = options;

  return [
    'PRAGMA foreign_keys = OFF;',
    ...(includeWipe ? buildD1WipeStatements() : []),
    ...members.map(buildMemberInsert),
    ...shinies.map(buildShinyInsert),
    ...users.map(buildUserInsert),
    ...feebasCycles.map(buildFeebasCycleInsert),
    ...feebasTileStates.map(buildFeebasTileStateInsert),
    ...feebasTileVotes.map(buildFeebasTileVoteInsert),
    ...feebasActivityLogs.map(buildFeebasActivityLogInsert),
    ...feebasConfirmedTileSnapshots.map(buildFeebasConfirmedTileSnapshotInsert),
    'PRAGMA foreign_keys = ON;',
  ].join('\n');
}

module.exports = {
  buildD1WipeStatements,
  buildFeebasActivityLogInsert,
  buildFeebasConfirmedTileSnapshotInsert,
  buildFeebasCycleInsert,
  buildFeebasTileStateInsert,
  buildFeebasTileVoteInsert,
  buildMemberInsert,
  buildShinyInsert,
  buildUserInsert,
  convertPostgresExportToD1Sql,
};
