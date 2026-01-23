const pool = require('../config/connection');

class TeamShiny {
  static async findAll(filters = {}) {
    let query = `
      SELECT ts.*, tm.ign as trainer_name, ts.pokemon as pokemon_name
      FROM team_shinies ts
      JOIN team_members tm ON ts.original_trainer = tm.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (filters.trainer_id) {
      paramCount++;
      query += ` AND ts.original_trainer = $${paramCount}`;
      params.push(filters.trainer_id);
    }

    if (filters.pokemon_name) {
      paramCount++;
      query += ` AND LOWER(ts.pokemon) LIKE LOWER($${paramCount})`;
      params.push(`%${filters.pokemon_name}%`);
    }

    if (filters.encounter_type) {
      paramCount++;
      query += ` AND ts.encounter_type = $${paramCount}`;
      params.push(filters.encounter_type);
    }

    if (filters.is_secret !== undefined) {
      paramCount++;
      query += ` AND ts.is_secret = $${paramCount}`;
      params.push(filters.is_secret);
    }

    if (filters.is_safari !== undefined) {
      paramCount++;
      query += ` AND ts.is_safari = $${paramCount}`;
      params.push(filters.is_safari);
    }

    query += ` ORDER BY ts.catch_date DESC`;

    if (filters.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
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
      is_safari = false,
      screenshot_url,
      notes
    } = shinyData;

    const result = await pool.query(`
      INSERT INTO team_shinies (
        national_number, pokemon, original_trainer, catch_date, total_encounters,
        species_encounters, encounter_type, location, 
        nature, iv_hp, iv_attack, iv_defense, iv_sp_attack,
        iv_sp_defense, iv_speed, is_secret, is_safari, screenshot_url, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `, [
      national_number, pokemon, original_trainer, catch_date, total_encounters,
      species_encounters, encounter_type, location, 
      nature, iv_hp, iv_attack, iv_defense, iv_sp_attack,
      iv_sp_defense, iv_speed, is_secret, is_safari, screenshot_url, notes
    ]);

    return result.rows[0];
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
      is_safari,
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
          is_safari = COALESCE($17, is_safari),
          screenshot_url = COALESCE($18, screenshot_url),
          notes = COALESCE($19, notes)
      WHERE id = $1
      RETURNING *
    `, [
      id, national_number, pokemon, catch_date, total_encounters, species_encounters,
      encounter_type, location, nature, 
      iv_hp, iv_attack, iv_defense, iv_sp_attack, iv_sp_defense, iv_speed,
      is_secret, is_safari, screenshot_url, notes
    ]);

    // Return the updated shiny with joined trainer_name
    return await this.findById(id);
  }

  static async delete(id) {
    const result = await pool.query(`
      DELETE FROM team_shinies 
      WHERE id = $1
      RETURNING *
    `, [id]);
    return result.rows[0];
  }

  static async getStats() {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_shinies,
        COUNT(DISTINCT original_trainer) as unique_trainers,
        COUNT(CASE WHEN is_secret THEN 1 END) as secret_shinies,
        COUNT(CASE WHEN is_safari THEN 1 END) as safari_shinies,
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
        COUNT(CASE WHEN ts.is_safari THEN 1 END) as safari_count
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