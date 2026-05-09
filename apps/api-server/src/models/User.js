const pool = require('../config/connection');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeIgn(ign) {
  return String(ign || '').trim();
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
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_login_at: row.last_login_at,
  };
}

class User {
  static toSafeUser(row) {
    return toSafeUser(row);
  }

  static normalizeEmail(email) {
    return normalizeEmail(email);
  }

  static normalizeIgn(ign) {
    return normalizeIgn(ign);
  }

  static async findById(id) {
    const result = await pool.query(`
      SELECT *
      FROM app_users
      WHERE id = $1
    `, [id]);

    return result.rows[0] || null;
  }

  static async findByEmail(email) {
    const result = await pool.query(`
      SELECT *
      FROM app_users
      WHERE LOWER(email) = LOWER($1)
    `, [normalizeEmail(email)]);

    return result.rows[0] || null;
  }

  static async findByDiscordId(discordId) {
    const result = await pool.query(`
      SELECT *
      FROM app_users
      WHERE discord_id = $1
    `, [discordId]);

    return result.rows[0] || null;
  }

  static async createWithPassword({ email, passwordHash, ign }) {
    const result = await pool.query(`
      INSERT INTO app_users (email, password_hash, ign, auth_provider)
      VALUES ($1, $2, $3, 'password')
      RETURNING *
    `, [normalizeEmail(email), passwordHash, normalizeIgn(ign)]);

    return result.rows[0];
  }

  static async createWithDiscord({ email, ign, discord }) {
    const result = await pool.query(`
      INSERT INTO app_users (
        email,
        ign,
        discord_id,
        discord_username,
        discord_global_name,
        discord_avatar,
        auth_provider
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'discord')
      RETURNING *
    `, [
      normalizeEmail(email),
      normalizeIgn(ign),
      discord.id,
      discord.username,
      discord.global_name,
      discord.avatar,
    ]);

    return result.rows[0];
  }

  static async attachDiscord(id, discord) {
    const result = await pool.query(`
      UPDATE app_users
      SET discord_id = $2,
          discord_username = $3,
          discord_global_name = $4,
          discord_avatar = $5,
          auth_provider = CASE
            WHEN password_hash IS NOT NULL THEN 'password_discord'
            ELSE 'discord'
          END,
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `, [
      id,
      discord.id,
      discord.username,
      discord.global_name,
      discord.avatar,
    ]);

    return result.rows[0] || null;
  }

  static async recordLogin(id) {
    const result = await pool.query(`
      UPDATE app_users
      SET last_login_at = now(),
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `, [id]);

    return result.rows[0] || null;
  }

  static async setPasswordResetToken(id, { tokenHash, expiresAt }) {
    const result = await pool.query(`
      UPDATE app_users
      SET password_reset_token_hash = $2,
          password_reset_expires_at = $3,
          password_reset_requested_at = now(),
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `, [id, tokenHash, expiresAt]);

    return result.rows[0] || null;
  }

  static async findByPasswordResetTokenHash(tokenHash) {
    const result = await pool.query(`
      SELECT *
      FROM app_users
      WHERE password_reset_token_hash = $1
      LIMIT 1
    `, [tokenHash]);

    return result.rows[0] || null;
  }

  static async clearPasswordResetToken(id) {
    const result = await pool.query(`
      UPDATE app_users
      SET password_reset_token_hash = NULL,
          password_reset_expires_at = NULL,
          password_reset_requested_at = NULL,
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `, [id]);

    return result.rows[0] || null;
  }

  static async updatePassword(id, passwordHash) {
    const result = await pool.query(`
      UPDATE app_users
      SET password_hash = $2,
          password_reset_token_hash = NULL,
          password_reset_expires_at = NULL,
          password_reset_requested_at = NULL,
          auth_provider = CASE
            WHEN discord_id IS NOT NULL THEN 'password_discord'
            ELSE 'password'
          END,
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `, [id, passwordHash]);

    return result.rows[0] || null;
  }
}

module.exports = User;
