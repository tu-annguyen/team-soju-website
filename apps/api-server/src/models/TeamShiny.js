const pool = require('../config/connection');

class TeamShiny {
  static async findAll(filters = {}) {
    const where = [];
    const params = [];

    const addParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    let query = `
      SELECT ts.*, tm.ign AS trainer_name, ts.pokemon AS pokemon_name
      FROM team_shinies ts
      JOIN team_members tm ON ts.original_trainer = tm.id
    `;

    if (filters.trainer_id) {
      where.push(`ts.original_trainer = ${addParam(filters.trainer_id)}`);
    }

    if (filters.pokemon_name) {
      where.push(`LOWER(ts.pokemon) LIKE LOWER(${addParam(`%${filters.pokemon_name}%`)})`);
    }

    if (filters.encounter_type) {
      where.push(`ts.encounter_type = ${addParam(filters.encounter_type)}`);
    }

    if (filters.is_secret !== undefined) {
      where.push(`ts.is_secret = ${addParam(filters.is_secret)}`);
    }

    if (filters.is_alpha !== undefined) {
      where.push(`ts.is_alpha = ${addParam(filters.is_alpha)}`);
    }

    if (filters.active !== undefined) {
      where.push(`tm.is_active = ${addParam(filters.active)}`);
    }

    if (filters.catch_date_after) {
      where.push(`ts.catch_date >= ${addParam(filters.catch_date_after)}`);
    }

    if (filters.catch_date_before) {
      where.push(`ts.catch_date <= ${addParam(filters.catch_date_before)}`);
    }

    if (where.length > 0) {
      query += ` WHERE ` + where.join(' AND ');
    }

    const allowedSortFields = {
      catch_date: 'ts.catch_date',
      total_encounters: 'ts.total_encounters',
    };

    const sortBy = allowedSortFields[filters.sort_by] || 'ts.catch_date';
    const sortOrder = filters.sort_order === 'asc' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortBy} ${sortOrder} NULLS FIRST, ts.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ${addParam(Number(filters.limit))}`;
    }

    const result = await pool.query(query, params);
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query(`
      SELECT ts.*, tm.ign as trainer_name, ts.pokemon as pokemon_name
      FROM team_shinies ts
      JOIN team_members tm ON ts.original_trainer = tm.id
      WHERE ts.id = $1
    `, [id]);
    return result.rows[0];
  }

  static async create(shinyData) {
    const {
      national_number,
      pokemon,
      original_trainer,
      catch_date,
      total_encounters = 0,
      species_encounters = 0,
      encounter_type,
      location,
      nature,
      iv_hp,
      iv_attack,
      iv_defense,
      iv_sp_attack, 
      iv_sp_defense,
      iv_speed,
      is_secret = false,
      is_alpha = false,
      screenshot_url,
      notes
    } = shinyData;

    const result = await pool.query(`
      INSERT INTO team_shinies (
        national_number, pokemon, original_trainer, catch_date, total_encounters,
        species_encounters, encounter_type, location, 
        nature, iv_hp, iv_attack, iv_defense, iv_sp_attack,
        iv_sp_defense, iv_speed, is_secret, is_alpha, screenshot_url, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id
    `, [
      national_number, pokemon, original_trainer, catch_date, total_encounters,
      species_encounters, encounter_type, location, 
      nature, iv_hp, iv_attack, iv_defense, iv_sp_attack,
      iv_sp_defense, iv_speed, is_secret, is_alpha, screenshot_url, notes
    ]);

    const insertedId = result.rows[0].id;
    return await this.findById(insertedId);
  }

  static async update(id, shinyData) {
    const {
      national_number,
      pokemon,
      catch_date,
      total_encounters,
      species_encounters,
      encounter_type,
      location,
      nature,
      iv_hp,
      iv_attack,
      iv_defense,
      iv_sp_attack,
      iv_sp_defense,
      iv_speed,
      is_secret,
      is_alpha,
      screenshot_url,
      notes
    } = shinyData;

    const result = await pool.query(`
      UPDATE team_shinies 
      SET national_number = COALESCE($2, national_number),
          pokemon = COALESCE($3, pokemon),
          catch_date = COALESCE($4, catch_date),
          total_encounters = COALESCE($5, total_encounters),
          species_encounters = COALESCE($6, species_encounters),
          encounter_type = COALESCE($7, encounter_type),
          location = COALESCE($8, location),
          nature = COALESCE($9, nature),
          iv_hp = COALESCE($10, iv_hp),
          iv_attack = COALESCE($11, iv_attack),
          iv_defense = COALESCE($12, iv_defense),
          iv_sp_attack = COALESCE($13, iv_sp_attack),
          iv_sp_defense = COALESCE($14, iv_sp_defense),
          iv_speed = COALESCE($15, iv_speed),
          is_secret = COALESCE($16, is_secret),
          is_alpha = COALESCE($17, is_alpha),
          screenshot_url = COALESCE($18, screenshot_url),
          notes = COALESCE($19, notes)
      WHERE id = $1
      RETURNING *
    `, [
      id, national_number, pokemon, catch_date, total_encounters, species_encounters,
      encounter_type, location, nature, 
      iv_hp, iv_attack, iv_defense, iv_sp_attack, iv_sp_defense, iv_speed,
      is_secret, is_alpha, screenshot_url, notes
    ]);

    // Return the updated shiny with joined trainer_name
    return await this.findById(id);
  }

  static async delete(id) {
    const shiny = await this.findById(id);
    if (!shiny) return null;

    await pool.query(`
      DELETE FROM team_shinies 
      WHERE id = $1
    `, [id]);
    return shiny;
  }

  static async getStats() {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_shinies,
        COUNT(DISTINCT original_trainer) as unique_trainers,
        COUNT(CASE WHEN is_secret THEN 1 END) as secret_shinies,
        COUNT(CASE WHEN is_alpha THEN 1 END) as alpha_shinies,
        COUNT(CASE WHEN encounter_type = 'safari' THEN 1 END) as safari_shinies,
        AVG(total_encounters) as avg_encounters,
        encounter_type,
        COUNT(*) as count_by_type
      FROM team_shinies
      GROUP BY encounter_type
      ORDER BY count_by_type DESC
    `);
    return result.rows;
  }

  static async getTopTrainers(limit = 10) {
    const result = await pool.query(`
      SELECT 
        tm.ign,
        tm.rank,
        COUNT(ts.id) as shiny_count,
        COUNT(CASE WHEN ts.is_secret THEN 1 END) as secret_count,
        COUNT(CASE WHEN ts.is_alpha THEN 1 END) as alpha_count,
        COUNT(CASE WHEN ts.encounter_type = 'safari' THEN 1 END) as safari_count
      FROM team_members tm
      LEFT JOIN team_shinies ts ON tm.id = ts.original_trainer
      WHERE tm.is_active = true
      GROUP BY tm.id, tm.ign, tm.rank
      ORDER BY shiny_count DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  }
}

module.exports = TeamShiny;