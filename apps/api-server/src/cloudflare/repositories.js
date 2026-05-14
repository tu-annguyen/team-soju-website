const crypto = globalThis.crypto || require('crypto');
const { Pool, types } = require('pg');
const { createFeebasRepository } = require('./feebas-repository');

types.setTypeParser(1082, (val) => val);

function parseD1Boolean(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
  return Boolean(value);
}

function normalizeShinyRow(row) {
  if (!row) return row;
  return {
    ...row,
    is_secret: parseD1Boolean(row.is_secret),
    is_alpha: parseD1Boolean(row.is_alpha),
  };
}

function normalizeMemberRow(row) {
  if (!row) return row;
  return {
    ...row,
    is_active: parseD1Boolean(row.is_active),
  };
}

function toSafeUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    ign: row.ign,
    discord_id: row.discord_id,
    discord_username: row.discord_username,
    discord_global_name: row.discord_global_name,
    discord_avatar: row.discord_avatar,
    auth_provider: row.auth_provider,
    email_verified_at: row.email_verified_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_login_at: row.last_login_at,
  };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeIgn(ign) {
  return String(ign || '').trim();
}

let cachedPool;

function resolveConnectionString(env) {
  return (
    env.DATABASE_URL ||
    null
  );
}

function createPostgresPool(env = process.env) {
  if (cachedPool) return cachedPool;

  cachedPool = new Pool({
    connectionString: resolveConnectionString(env),
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  return cachedPool;
}

function mapD1Rows(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  return result.results || [];
}

function createPostgresRepositories(env = process.env, options = {}) {
  const pool = options.pool || createPostgresPool(env);
  const query = (text, params = []) => pool.query(text, params);

  return createRepositoryBundle({
    query,
    parameter: (index) => `$${index}`,
    runSelect: async (text, params) => {
      const result = await query(text, params);
      return result.rows;
    },
    runOne: async (text, params) => {
      const rows = await query(text, params);
      return rows.rows[0] || null;
    },
    runCommand: async (text, params) => query(text, params),
    dialect: 'postgres',
  });
}

function createD1Repositories(env, options = {}) {
  const binding = options.db || env.DB;
  if (!binding) {
    throw new Error('D1 binding "DB" is required when DB_BACKEND=d1.');
  }
  const db = typeof binding.withSession === 'function'
    ? binding.withSession(options.sessionBookmark || 'first-primary')
    : binding;

  const execute = async (text, params = []) => {
    const statement = db.prepare(text).bind(...params);
    return statement;
  };

  return createRepositoryBundle({
    query: execute,
    parameter: (index) => `?${index}`,
    runSelect: async (text, params) => mapD1Rows(await (await execute(text, params)).all()),
    runOne: async (text, params) => {
      const result = await (await execute(text, params)).first();
      return result || null;
    },
    runCommand: async (text, params) => (await execute(text, params)).run(),
    dialect: 'd1',
  });
}

function createRepositoryBundle({ query, parameter, runSelect, runOne, runCommand, dialect }) {
  function addParam(params, value) {
    params.push(value);
    return parameter(params.length);
  }

  const members = {
    async findAll() {
      const rows = await runSelect(`
        SELECT tm.*,
               COUNT(ts.id) as shiny_count
        FROM team_members tm
        LEFT JOIN team_shinies ts ON tm.id = ts.original_trainer
        WHERE tm.is_active = ${dialect === 'd1' ? '1' : 'true'}
        GROUP BY tm.id
        ORDER BY tm.join_date ASC
      `, []);
      return rows.map(normalizeMemberRow);
    },

    async findById(id) {
      const rows = await runSelect(`
        SELECT tm.*,
               COUNT(ts.id) as shiny_count
        FROM team_members tm
        LEFT JOIN team_shinies ts ON tm.id = ts.original_trainer
        WHERE tm.id = ${parameter(1)} AND tm.is_active = ${dialect === 'd1' ? '1' : 'true'}
        GROUP BY tm.id
      `, [id]);
      return normalizeMemberRow(rows[0] || null);
    },

    async findByIgn(ign) {
      const rows = await runSelect(`
        SELECT tm.*,
               COUNT(ts.id) as shiny_count
        FROM team_members tm
        LEFT JOIN team_shinies ts ON tm.id = ts.original_trainer
        WHERE LOWER(tm.ign) = LOWER(${parameter(1)}) AND tm.is_active = ${dialect === 'd1' ? '1' : 'true'}
        GROUP BY tm.id
      `, [ign]);
      return normalizeMemberRow(rows[0] || null);
    },

    async findByIgnIncludingInactive(ign) {
      const rows = await runSelect(`
        SELECT tm.*,
               COUNT(ts.id) as shiny_count
        FROM team_members tm
        LEFT JOIN team_shinies ts ON tm.id = ts.original_trainer
        WHERE LOWER(tm.ign) = LOWER(${parameter(1)})
        GROUP BY tm.id
      `, [ign]);
      return normalizeMemberRow(rows[0] || null);
    },

    async findByDiscordId(discordId) {
      const rows = await runSelect(`
        SELECT tm.*,
               COUNT(ts.id) as shiny_count
        FROM team_members tm
        LEFT JOIN team_shinies ts ON tm.id = ts.original_trainer
        WHERE tm.discord_id = ${parameter(1)} AND tm.is_active = ${dialect === 'd1' ? '1' : 'true'}
        GROUP BY tm.id
      `, [discordId]);
      return normalizeMemberRow(rows[0] || null);
    },

    async create(memberData) {
      const id = memberData.id || crypto.randomUUID();
      const params = [id, memberData.ign, memberData.discord_id || null, memberData.rank || 'Member', memberData.notes || null];
      if (dialect === 'd1') {
        await (await query(`
          INSERT INTO team_members (id, ign, discord_id, rank, notes)
          VALUES (?, ?, ?, ?, ?)
        `, params)).run();
        return runOne(`SELECT * FROM team_members WHERE id = ?`, [id]).then(normalizeMemberRow);
      }

      const result = await query(`
        INSERT INTO team_members (id, ign, discord_id, rank, notes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, params);
      return normalizeMemberRow(result.rows[0]);
    },

    async update(id, memberData) {
      const { ign, discord_id, rank, notes, is_active } = memberData;

      if (dialect === 'd1') {
        await (await query(`
          UPDATE team_members
          SET ign = COALESCE(?, ign),
              discord_id = COALESCE(?, discord_id),
              rank = COALESCE(?, rank),
              notes = COALESCE(?, notes),
              is_active = COALESCE(?, is_active)
          WHERE id = ?
        `, [ign ?? null, discord_id ?? null, rank ?? null, notes ?? null, is_active ?? null, id])).run();
        return runOne(`SELECT * FROM team_members WHERE id = ?`, [id]).then(normalizeMemberRow);
      }

      const result = await query(`
        UPDATE team_members
        SET ign = COALESCE($2, ign),
            discord_id = COALESCE($3, discord_id),
            rank = COALESCE($4, rank),
            notes = COALESCE($5, notes),
            is_active = COALESCE($6, is_active)
        WHERE id = $1
        RETURNING *
      `, [id, ign, discord_id, rank, notes, is_active]);
      return normalizeMemberRow(result.rows[0] || null);
    },

    async delete(id) {
      return this.update(id, { is_active: dialect === 'd1' ? 0 : false });
    },

    async reactivate(id) {
      return this.update(id, { is_active: dialect === 'd1' ? 1 : true });
    },

    async getShinyStats(memberId) {
      const rows = await runSelect(`
        SELECT
          COUNT(*) as total_shinies,
          COUNT(CASE WHEN is_secret = ${dialect === 'd1' ? '1' : 'true'} THEN 1 END) as secret_shinies,
          COUNT(CASE WHEN is_alpha = ${dialect === 'd1' ? '1' : 'true'} THEN 1 END) as alpha_shinies,
          COUNT(CASE WHEN encounter_type = 'safari' THEN 1 END) as safari_shinies,
          AVG(total_encounters) as avg_encounters,
          encounter_type,
          COUNT(*) as count_by_type
        FROM team_shinies
        WHERE original_trainer = ${parameter(1)}
        GROUP BY encounter_type
        ORDER BY count_by_type DESC
      `, [memberId]);
      return rows.map(normalizeShinyRow);
    },
  };

  const shinies = {
    async findAll(filters = {}) {
      const where = [];
      const params = [];

      let sql = `
        SELECT ts.*, tm.ign AS trainer_name, ts.pokemon AS pokemon_name
        FROM team_shinies ts
        JOIN team_members tm ON ts.original_trainer = tm.id
      `;

      if (filters.trainer_id) {
        where.push(`ts.original_trainer = ${addParam(params, filters.trainer_id)}`);
      }
      if (filters.pokemon_name) {
        where.push(`LOWER(ts.pokemon) LIKE LOWER(${addParam(params, `%${filters.pokemon_name}%`)})`);
      }
      if (filters.encounter_type) {
        where.push(`ts.encounter_type = ${addParam(params, filters.encounter_type)}`);
      }
      if (filters.is_secret !== undefined) {
        where.push(`ts.is_secret = ${addParam(params, dialect === 'd1' ? Number(filters.is_secret) : filters.is_secret)}`);
      }
      if (filters.is_alpha !== undefined) {
        where.push(`ts.is_alpha = ${addParam(params, dialect === 'd1' ? Number(filters.is_alpha) : filters.is_alpha)}`);
      }
      if (filters.active !== undefined) {
        where.push(`tm.is_active = ${addParam(params, dialect === 'd1' ? Number(filters.active) : filters.active)}`);
      }
      if (filters.catch_date_after) {
        where.push(`ts.catch_date >= ${addParam(params, filters.catch_date_after)}`);
      }
      if (filters.catch_date_before) {
        where.push(`ts.catch_date <= ${addParam(params, filters.catch_date_before)}`);
      }

      if (where.length) {
        sql += ` WHERE ${where.join(' AND ')}`;
      }

      const allowedSortFields = {
        catch_date: 'ts.catch_date',
        total_encounters: 'ts.total_encounters',
      };
      const primarySortBy = allowedSortFields[filters.sort_by] || 'ts.catch_date';
      const primarySortOrder = filters.sort_order === 'asc' ? 'ASC' : 'DESC';
      const secondarySortBy = allowedSortFields[filters.secondary_sort_by] || 'ts.created_at';
      const secondarySortOrder = filters.secondary_sort_order === 'asc' ? 'ASC' : 'DESC';
      const orderByClauses = [`${primarySortBy} ${primarySortOrder}`];

      if (secondarySortBy !== primarySortBy) {
        orderByClauses.push(`${secondarySortBy} ${secondarySortOrder}`);
      }
      if (secondarySortBy !== 'ts.created_at') {
        orderByClauses.push('ts.created_at DESC');
      }

      sql += ` ORDER BY ${orderByClauses.join(', ')}`;
      if (filters.limit) {
        sql += ` LIMIT ${addParam(params, Number(filters.limit))}`;
      }

      const rows = await runSelect(sql, params);
      return rows.map(normalizeShinyRow);
    },

    async findById(id) {
      const rows = await runSelect(`
        SELECT ts.*, tm.ign AS trainer_name, ts.pokemon AS pokemon_name
        FROM team_shinies ts
        JOIN team_members tm ON ts.original_trainer = tm.id
        WHERE ts.id = ${parameter(1)}
      `, [id]);
      return normalizeShinyRow(rows[0] || null);
    },

    async create(shinyData) {
      const id = shinyData.id || crypto.randomUUID();
      const params = [
        id,
        shinyData.national_number,
        shinyData.pokemon,
        shinyData.variants ?? null,
        shinyData.original_trainer,
        shinyData.catch_date,
        shinyData.total_encounters ?? 0,
        shinyData.species_encounters ?? 0,
        shinyData.encounter_type,
        shinyData.location ?? null,
        shinyData.nature ?? null,
        shinyData.iv_hp ?? null,
        shinyData.iv_attack ?? null,
        shinyData.iv_defense ?? null,
        shinyData.iv_sp_attack ?? null,
        shinyData.iv_sp_defense ?? null,
        shinyData.iv_speed ?? null,
        dialect === 'd1' ? Number(Boolean(shinyData.is_secret)) : Boolean(shinyData.is_secret),
        dialect === 'd1' ? Number(Boolean(shinyData.is_alpha)) : Boolean(shinyData.is_alpha),
        shinyData.screenshot_url ?? null,
        shinyData.status || 'Owned',
        shinyData.notes ?? null,
      ];

      if (dialect === 'd1') {
        await (await query(`
          INSERT INTO team_shinies (
            id, national_number, pokemon, variants, original_trainer, catch_date, total_encounters,
            species_encounters, encounter_type, location, nature, iv_hp, iv_attack, iv_defense,
            iv_sp_attack, iv_sp_defense, iv_speed, is_secret, is_alpha, screenshot_url, status, notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, params)).run();
        return this.findById(id);
      }

      const result = await query(`
        INSERT INTO team_shinies (
          id, national_number, pokemon, variants, original_trainer, catch_date, total_encounters,
          species_encounters, encounter_type, location, nature, iv_hp, iv_attack, iv_defense,
          iv_sp_attack, iv_sp_defense, iv_speed, is_secret, is_alpha, screenshot_url, status, notes
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
        )
        RETURNING id
      `, params);
      return this.findById(result.rows[0].id);
    },

    async update(id, shinyData) {
      if (dialect === 'd1') {
        await (await query(`
          UPDATE team_shinies
          SET national_number = COALESCE(?, national_number),
              pokemon = COALESCE(?, pokemon),
              variants = CASE WHEN ? THEN ? ELSE variants END,
              catch_date = COALESCE(?, catch_date),
              total_encounters = COALESCE(?, total_encounters),
              species_encounters = COALESCE(?, species_encounters),
              encounter_type = COALESCE(?, encounter_type),
              location = COALESCE(?, location),
              nature = COALESCE(?, nature),
              iv_hp = COALESCE(?, iv_hp),
              iv_attack = COALESCE(?, iv_attack),
              iv_defense = COALESCE(?, iv_defense),
              iv_sp_attack = COALESCE(?, iv_sp_attack),
              iv_sp_defense = COALESCE(?, iv_sp_defense),
              iv_speed = COALESCE(?, iv_speed),
              is_secret = COALESCE(?, is_secret),
              is_alpha = COALESCE(?, is_alpha),
              screenshot_url = COALESCE(?, screenshot_url),
              status = CASE WHEN ? THEN ? ELSE status END,
              notes = CASE WHEN ? THEN ? ELSE notes END
          WHERE id = ?
        `, [
          shinyData.national_number ?? null,
          shinyData.pokemon ?? null,
          Object.prototype.hasOwnProperty.call(shinyData, 'variants') ? 1 : 0,
          shinyData.variants ?? null,
          shinyData.catch_date ?? null,
          shinyData.total_encounters ?? null,
          shinyData.species_encounters ?? null,
          shinyData.encounter_type ?? null,
          shinyData.location ?? null,
          shinyData.nature ?? null,
          shinyData.iv_hp ?? null,
          shinyData.iv_attack ?? null,
          shinyData.iv_defense ?? null,
          shinyData.iv_sp_attack ?? null,
          shinyData.iv_sp_defense ?? null,
          shinyData.iv_speed ?? null,
          Object.prototype.hasOwnProperty.call(shinyData, 'is_secret') ? Number(Boolean(shinyData.is_secret)) : null,
          Object.prototype.hasOwnProperty.call(shinyData, 'is_alpha') ? Number(Boolean(shinyData.is_alpha)) : null,
          shinyData.screenshot_url ?? null,
          Object.prototype.hasOwnProperty.call(shinyData, 'status') ? 1 : 0,
          shinyData.status ?? null,
          Object.prototype.hasOwnProperty.call(shinyData, 'notes') ? 1 : 0,
          shinyData.notes ?? null,
          id,
        ])).run();
        return this.findById(id);
      }

      const result = await query(`
        UPDATE team_shinies
        SET national_number = COALESCE($2, national_number),
            pokemon = COALESCE($3, pokemon),
            variants = CASE WHEN $5 THEN $4 ELSE variants END,
            catch_date = COALESCE($6, catch_date),
            total_encounters = COALESCE($7, total_encounters),
            species_encounters = COALESCE($8, species_encounters),
            encounter_type = COALESCE($9, encounter_type),
            location = COALESCE($10, location),
            nature = COALESCE($11, nature),
            iv_hp = COALESCE($12, iv_hp),
            iv_attack = COALESCE($13, iv_attack),
            iv_defense = COALESCE($14, iv_defense),
            iv_sp_attack = COALESCE($15, iv_sp_attack),
            iv_sp_defense = COALESCE($16, iv_sp_defense),
            iv_speed = COALESCE($17, iv_speed),
            is_secret = COALESCE($18, is_secret),
            is_alpha = COALESCE($19, is_alpha),
            screenshot_url = COALESCE($20, screenshot_url),
            status = CASE WHEN $22 THEN $21 ELSE status END,
            notes = CASE WHEN $24 THEN $23 ELSE notes END
        WHERE id = $1
        RETURNING *
      `, [
        id,
        shinyData.national_number,
        shinyData.pokemon,
        shinyData.variants,
        Object.prototype.hasOwnProperty.call(shinyData, 'variants'),
        shinyData.catch_date,
        shinyData.total_encounters,
        shinyData.species_encounters,
        shinyData.encounter_type,
        shinyData.location,
        shinyData.nature,
        shinyData.iv_hp,
        shinyData.iv_attack,
        shinyData.iv_defense,
        shinyData.iv_sp_attack,
        shinyData.iv_sp_defense,
        shinyData.iv_speed,
        shinyData.is_secret,
        shinyData.is_alpha,
        shinyData.screenshot_url,
        shinyData.status,
        Object.prototype.hasOwnProperty.call(shinyData, 'status'),
        shinyData.notes,
        Object.prototype.hasOwnProperty.call(shinyData, 'notes'),
      ]);
      if (!result.rows[0]) return null;
      return this.findById(id);
    },

    async delete(id) {
      const shiny = await this.findById(id);
      if (!shiny) return null;

      if (dialect === 'd1') {
        await (await query(`DELETE FROM team_shinies WHERE id = ?`, [id])).run();
      } else {
        await query(`DELETE FROM team_shinies WHERE id = $1`, [id]);
      }

      return shiny;
    },

    async getStats() {
      const rows = await runSelect(`
        SELECT
          COUNT(*) as total_shinies,
          COUNT(DISTINCT original_trainer) as unique_trainers,
          COUNT(CASE WHEN is_secret = ${dialect === 'd1' ? '1' : 'true'} THEN 1 END) as secret_shinies,
          COUNT(CASE WHEN is_alpha = ${dialect === 'd1' ? '1' : 'true'} THEN 1 END) as alpha_shinies,
          COUNT(CASE WHEN encounter_type = 'safari' THEN 1 END) as safari_shinies,
          AVG(total_encounters) as avg_encounters,
          encounter_type,
          COUNT(*) as count_by_type
        FROM team_shinies
        GROUP BY encounter_type
        ORDER BY count_by_type DESC
      `, []);
      return rows.map(normalizeShinyRow);
    },

    async getTopTrainers(limit = 10) {
      const rows = await runSelect(`
        SELECT
          tm.ign,
          tm.rank,
          COUNT(ts.id) as shiny_count,
          COUNT(CASE WHEN ts.is_secret = ${dialect === 'd1' ? '1' : 'true'} THEN 1 END) as secret_count,
          COUNT(CASE WHEN ts.is_alpha = ${dialect === 'd1' ? '1' : 'true'} THEN 1 END) as alpha_count,
          COUNT(CASE WHEN ts.encounter_type = 'safari' THEN 1 END) as safari_count
        FROM team_members tm
        LEFT JOIN team_shinies ts ON tm.id = ts.original_trainer
        WHERE tm.is_active = ${dialect === 'd1' ? '1' : 'true'}
        GROUP BY tm.id, tm.ign, tm.rank
        ORDER BY shiny_count DESC
        LIMIT ${parameter(1)}
      `, [limit]);
      return rows.map(normalizeMemberRow);
    },
  };

  const users = {
    normalizeEmail,
    normalizeIgn,

    async findById(id) {
      return runOne(`
        SELECT *
        FROM app_users
        WHERE id = ${parameter(1)}
      `, [id]);
    },

    async findByEmail(email) {
      return runOne(`
        SELECT *
        FROM app_users
        WHERE LOWER(email) = LOWER(${parameter(1)})
      `, [normalizeEmail(email)]);
    },

    async findByDiscordId(discordId) {
      return runOne(`
        SELECT *
        FROM app_users
        WHERE discord_id = ${parameter(1)}
      `, [discordId]);
    },

    async createWithPassword({ email, passwordHash, ign, verificationTokenHash, verificationExpiresAt }) {
      const id = crypto.randomUUID();
      const nowExpression = dialect === 'd1' ? "datetime('now')" : 'now()';
      await runCommand(`
        INSERT INTO app_users (
          id,
          email,
          password_hash,
          ign,
          auth_provider,
          email_verification_token_hash,
          email_verification_expires_at,
          email_verification_sent_at,
          email_verified_at
        )
        VALUES (
          ${parameter(1)}, ${parameter(2)}, ${parameter(3)}, ${parameter(4)}, 'password',
          ${parameter(5)}, ${parameter(6)}, ${nowExpression}, NULL
        )
      `, [
        id,
        normalizeEmail(email),
        passwordHash,
        normalizeIgn(ign),
        verificationTokenHash,
        verificationExpiresAt instanceof Date ? verificationExpiresAt.toISOString() : verificationExpiresAt,
      ]);
      return this.findById(id);
    },

    async createWithDiscord({ email, ign, discord }) {
      const id = crypto.randomUUID();
      const nowExpression = dialect === 'd1' ? "datetime('now')" : 'now()';
      await runCommand(`
        INSERT INTO app_users (
          id,
          email,
          ign,
          discord_id,
          discord_username,
          discord_global_name,
          discord_avatar,
          auth_provider,
          email_verified_at
        )
        VALUES (
          ${parameter(1)}, ${parameter(2)}, ${parameter(3)}, ${parameter(4)}, ${parameter(5)},
          ${parameter(6)}, ${parameter(7)}, 'discord', ${nowExpression}
        )
      `, [
        id,
        normalizeEmail(email),
        normalizeIgn(ign),
        discord.id,
        discord.username,
        discord.global_name,
        discord.avatar,
      ]);
      return this.findById(id);
    },

    async attachDiscord(id, discord) {
      const nowExpression = dialect === 'd1' ? "datetime('now')" : 'now()';
      await runCommand(`
        UPDATE app_users
        SET discord_id = ${parameter(2)},
            discord_username = ${parameter(3)},
            discord_global_name = ${parameter(4)},
            discord_avatar = ${parameter(5)},
            auth_provider = CASE
              WHEN password_hash IS NOT NULL THEN 'password_discord'
              ELSE 'discord'
            END,
            updated_at = ${nowExpression}
        WHERE id = ${parameter(1)}
      `, [
        id,
        discord.id,
        discord.username,
        discord.global_name,
        discord.avatar,
      ]);
      return this.findById(id);
    },

    async findByPasswordResetTokenHash(tokenHash) {
      return runOne(`
        SELECT *
        FROM app_users
        WHERE password_reset_token_hash = ${parameter(1)}
        LIMIT 1
      `, [tokenHash]);
    },

    async findByEmailVerificationTokenHash(tokenHash) {
      return runOne(`
        SELECT *
        FROM app_users
        WHERE email_verification_token_hash = ${parameter(1)}
        LIMIT 1
      `, [tokenHash]);
    },

    async recordLogin(id) {
      const nowExpression = dialect === 'd1' ? "datetime('now')" : 'now()';
      await runCommand(`
        UPDATE app_users
        SET last_login_at = ${nowExpression},
            updated_at = ${nowExpression}
        WHERE id = ${parameter(1)}
      `, [id]);
      return this.findById(id);
    },

    async setPasswordResetToken(id, { tokenHash, expiresAt }) {
      const nowExpression = dialect === 'd1' ? "datetime('now')" : 'now()';
      const result = await runCommand(`
        UPDATE app_users
        SET password_reset_token_hash = ${parameter(2)},
            password_reset_expires_at = ${parameter(3)},
            password_reset_requested_at = ${nowExpression},
            updated_at = ${nowExpression}
        WHERE id = ${parameter(1)}
      `, [id, tokenHash, expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt]);
      const updatedUser = await this.findById(id);
      if (dialect === 'd1') {
        console.log('Password reset token update result:', {
          userId: id,
          success: result?.success,
          changedDb: result?.meta?.changed_db,
          changes: result?.meta?.changes,
          rowsWritten: result?.meta?.rows_written,
          persistedHashPrefix: updatedUser?.password_reset_token_hash?.slice(0, 8) || null,
          persistedExpiresAt: updatedUser?.password_reset_expires_at || null,
        });
      }
      return updatedUser;
    },

    async clearPasswordResetToken(id) {
      const nowExpression = dialect === 'd1' ? "datetime('now')" : 'now()';
      await runCommand(`
        UPDATE app_users
        SET password_reset_token_hash = NULL,
            password_reset_expires_at = NULL,
            password_reset_requested_at = NULL,
            updated_at = ${nowExpression}
        WHERE id = ${parameter(1)}
      `, [id]);
      return this.findById(id);
    },

    async setEmailVerificationToken(id, { tokenHash, expiresAt }) {
      const nowExpression = dialect === 'd1' ? "datetime('now')" : 'now()';
      await runCommand(`
        UPDATE app_users
        SET email_verification_token_hash = ${parameter(2)},
            email_verification_expires_at = ${parameter(3)},
            email_verification_sent_at = ${nowExpression},
            updated_at = ${nowExpression}
        WHERE id = ${parameter(1)}
      `, [id, tokenHash, expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt]);
      return this.findById(id);
    },

    async updateEmail(id, { email, tokenHash, expiresAt }) {
      const nowExpression = dialect === 'd1' ? "datetime('now')" : 'now()';
      await runCommand(`
        UPDATE app_users
        SET email = ${parameter(2)},
            email_verification_token_hash = ${parameter(3)},
            email_verification_expires_at = ${parameter(4)},
            email_verification_sent_at = ${nowExpression},
            email_verified_at = NULL,
            updated_at = ${nowExpression}
        WHERE id = ${parameter(1)}
      `, [id, normalizeEmail(email), tokenHash, expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt]);
      return this.findById(id);
    },

    async markEmailVerified(id) {
      const nowExpression = dialect === 'd1' ? "datetime('now')" : 'now()';
      await runCommand(`
        UPDATE app_users
        SET email_verification_token_hash = NULL,
            email_verification_expires_at = NULL,
            email_verification_sent_at = NULL,
            email_verified_at = ${nowExpression},
            updated_at = ${nowExpression}
        WHERE id = ${parameter(1)}
      `, [id]);
      return this.findById(id);
    },

    async updatePassword(id, passwordHash) {
      const nowExpression = dialect === 'd1' ? "datetime('now')" : 'now()';
      await runCommand(`
        UPDATE app_users
        SET password_hash = ${parameter(2)},
            password_reset_token_hash = NULL,
            password_reset_expires_at = NULL,
            password_reset_requested_at = NULL,
            auth_provider = CASE
              WHEN discord_id IS NOT NULL THEN 'password_discord'
              ELSE 'password'
            END,
            updated_at = ${nowExpression}
        WHERE id = ${parameter(1)}
      `, [id, passwordHash]);
      return this.findById(id);
    },

    async deleteById(id) {
      await runCommand(`
        DELETE FROM app_users
        WHERE id = ${parameter(1)}
      `, [id]);
    },

    toSafeUser,
  };

  const feebas = createFeebasRepository({
    dialect,
    parameter,
    runCommand,
    runOne,
    runSelect,
  });

  return { feebas, members, shinies, users };
}

function createRepositories(env = process.env, options = {}) {
  const backend = (env.DB_BACKEND || 'postgres').toLowerCase();
  if (backend === 'd1') {
    return createD1Repositories(env, options);
  }
  return createPostgresRepositories(env, options);
}

module.exports = {
  createD1Repositories,
  createPostgresPool,
  createPostgresRepositories,
  createRepositories,
  normalizeMemberRow,
  normalizeShinyRow,
  resolveConnectionString,
  toSafeUser,
};
