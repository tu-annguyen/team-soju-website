const pool = require('../config/connection');

class TeamMember {
  static async findAll() {
    const result = await pool.query(`
      SELECT tm.*, 
             COUNT(ts.id) as shiny_count
      FROM team_members tm
      LEFT JOIN team_shinies ts ON tm.id = ts.original_trainer
      WHERE tm.is_active = true
      GROUP BY tm.id
      ORDER BY tm.join_date ASC
    `);
    return result.rows;
  }

  static async findById(id) {
    const result = await pool.query(`
      SELECT tm.*, 
             COUNT(ts.id) as shiny_count
      FROM team_members tm
      LEFT JOIN team_shinies ts ON tm.id = ts.original_trainer
      WHERE tm.id = $1 AND tm.is_active = true
      GROUP BY tm.id
    `, [id]);
    return result.rows[0];
  }

  static async findByIgn(ign) {
    const result = await pool.query(`
      SELECT tm.*, 
             COUNT(ts.id) as shiny_count
      FROM team_members tm
      LEFT JOIN team_shinies ts ON tm.id = ts.original_trainer
      WHERE LOWER(tm.ign) = LOWER($1) AND tm.is_active = true
      GROUP BY tm.id
    `, [ign]);
    return result.rows[0];
  }

  static async findByIgnIncludingInactive(ign) {
    const result = await pool.query(`
      SELECT tm.*, 
             COUNT(ts.id) as shiny_count
      FROM team_members tm
      LEFT JOIN team_shinies ts ON tm.id = ts.original_trainer
      WHERE LOWER(tm.ign) = LOWER($1)
      GROUP BY tm.id
    `, [ign]);
    return result.rows[0];
  }

  static async findByDiscordId(discordId) {
    const result = await pool.query(`
      SELECT tm.*, 
             COUNT(ts.id) as shiny_count
      FROM team_members tm
      LEFT JOIN team_shinies ts ON tm.id = ts.original_trainer
      WHERE tm.discord_id = $1 AND tm.is_active = true
      GROUP BY tm.id
    `, [discordId]);
    return result.rows[0];
  }

  static async create(memberData) {
    const { ign, discord_id, rank = 'Member', notes } = memberData;
    const result = await pool.query(`
      INSERT INTO team_members (ign, discord_id, rank, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [ign, discord_id, rank, notes]);
    return result.rows[0];
  }

  static async update(id, memberData) {
    const { ign, discord_id, rank, notes, is_active } = memberData;
    const result = await pool.query(`
      UPDATE team_members 
      SET ign = COALESCE($2, ign),
          discord_id = COALESCE($3, discord_id),
          rank = COALESCE($4, rank),
          notes = COALESCE($5, notes),
          is_active = COALESCE($6, is_active)
      WHERE id = $1
      RETURNING *
    `, [id, ign, discord_id, rank, notes, is_active]);
    return result.rows[0];
  }

  static async delete(id) {
    // Soft delete by setting is_active to false
    const result = await pool.query(`
      UPDATE team_members 
      SET is_active = false
      WHERE id = $1
      RETURNING *
    `, [id]);
    return result.rows[0];
  }

  static async reactivate(id) {
    // Reactivate member by setting is_active to true
    const result = await pool.query(`
      UPDATE team_members 
      SET is_active = true
      WHERE id = $1
      RETURNING *
    `, [id]);
    return result.rows[0];
  }

  static async getShinyStats(memberId) {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_shinies,
        COUNT(CASE WHEN is_secret THEN 1 END) as secret_shinies,
        COUNT(CASE WHEN is_safari THEN 1 END) as safari_shinies,
        AVG(total_encounters) as avg_encounters,
        encounter_type,
        COUNT(*) as count_by_type
      FROM team_shinies 
      WHERE original_trainer = $1
      GROUP BY encounter_type
      ORDER BY count_by_type DESC
    `, [memberId]);
    return result.rows;
  }
}

module.exports = TeamMember;