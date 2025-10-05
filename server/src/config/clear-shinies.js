const pool = require('./connection');

async function clearShinies() {
  try {
    console.log('Deleting all entries from team_shinies table...');
    
    await pool.query('DELETE FROM team_shinies');
    
    console.log('Successfully deleted all shinies!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to delete shinies:', error);
    process.exit(1);
  }
}

clearShinies();