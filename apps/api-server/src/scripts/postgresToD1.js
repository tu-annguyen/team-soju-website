function toSqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function normalizeBoolean(value) {
  return value ? 1 : 0;
}

function buildMemberInsert(member) {
  return `INSERT INTO team_members (id, ign, discord_id, rank, notes, join_date, is_active) VALUES (${[
    toSqlLiteral(member.id),
    toSqlLiteral(member.ign),
    toSqlLiteral(member.discord_id),
    toSqlLiteral(member.rank),
    toSqlLiteral(member.notes),
    toSqlLiteral(member.join_date),
    normalizeBoolean(member.is_active),
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
    toSqlLiteral(shiny.variants),
    toSqlLiteral(shiny.national_number),
    toSqlLiteral(shiny.original_trainer),
    toSqlLiteral(shiny.catch_date),
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
    toSqlLiteral(shiny.created_at),
  ].join(', ')});`;
}

function convertPostgresExportToD1Sql({ members = [], shinies = [] }) {
  return [
    'PRAGMA foreign_keys = OFF;',
    ...members.map(buildMemberInsert),
    ...shinies.map(buildShinyInsert),
    'PRAGMA foreign_keys = ON;',
  ].join('\n');
}

module.exports = {
  buildMemberInsert,
  buildShinyInsert,
  convertPostgresExportToD1Sql,
};
