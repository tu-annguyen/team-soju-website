const pool = require('../database/connection');

class TeamShiny {
  static async findAll(filters = {}) {
    let query = `
      SELECT ts.*, tm.ign as trainer_name, ps.name as pokemon_name
      FROM team_shinies ts
      JOIN team_members tm ON ts.original_trainer = tm.id
      JOIN pokemon_species ps ON ts.pokedex_number = ps.pokedex_number
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
      query += ` AND LOWER(ps.name) LIKE LOWER($${paramCount})`;
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
      SELECT ts.*, tm.ign as trainer_name, ps.name as pokemon_name
      FROM team_shinies ts
      JOIN team_members tm ON ts.original_trainer = tm.id
      JOIN pokemon_species ps ON ts.pokedex_number = ps.pokedex_number
      WHERE ts.id = $1
    `, [id]);
    return result.rows[0];
  }

  static async create(shinyData) {
    const {
      pokedex_number,
      original_trainer,
      catch_date,
      total_encounters = 0,
      species_encounters = 0,
      encounter_type,
      location,
      level_caught,
      nature,
      ability,
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
        pokedex_number, original_trainer, catch_date, total_encounters,
        species_encounters, encounter_type, location, level_caught,
        nature, ability, iv_hp, iv_attack, iv_defense, iv_sp_attack,
        iv_sp_defense, iv_speed, is_secret, is_safari, screenshot_url, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `, [
      pokedex_number, original_trainer, catch_date, total_encounters,
      species_encounters, encounter_type, location, level_caught,
      nature, ability, iv_hp, iv_attack, iv_defense, iv_sp_attack,
      iv_sp_defense, iv_speed, is_secret, is_safari, screenshot_url, notes
    ]);

    return result.rows[0];
  }

  static async update(id, shinyData) {
    const {
      pokedex_number,
      catch_date,
      total_encounters,
      species_encounters,
      encounter_type,
      location,
      level_caught,
      nature,
      ability,
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
      SET pokedex_number = COALESCE($2, pokedex_number),
          catch_date = COALESCE($3, catch_date),
          total_encounters = COALESCE($4, total_encounters),
          species_encounters = COALESCE($5, species_encounters),
          encounter_type = COALESCE($6, encounter_type),
          location = COALESCE($7, location),
          level_caught = COALESCE($8, level_caught),
          nature = COALESCE($9, nature),
          ability = COALESCE($10, ability),
          iv_hp = COALESCE($11, iv_hp),
          iv_attack = COALESCE($12, iv_attack),
          iv_defense = COALESCE($13, iv_defense),
          iv_sp_attack = COALESCE($14, iv_sp_attack),
          iv_sp_defense = COALESCE($15, iv_sp_defense),
          iv_speed = COALESCE($16, iv_speed),
          is_secret = COALESCE($17, is_secret),
          is_safari = COALESCE($18, is_safari),
          screenshot_url = COALESCE($19, screenshot_url),
          notes = COALESCE($20, notes)
      WHERE id = $1
      RETURNING *
    `, [
      id, pokedex_number, catch_date, total_encounters, species_encounters,
      encounter_type, location, level_caught, nature, ability,
      iv_hp, iv_attack, iv_defense, iv_sp_attack, iv_sp_defense, iv_speed,
      is_secret, is_safari, screenshot_url, notes
    ]);

    return result.rows[0];
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