const pool = require('./connection');

async function clearShinies() {
  try {
    console.log('Deleting all entries from team_shinies table...');
    
    await pool.query('DELETE FROM team_shinies');
    
    console.log('Successfully deleted all shinies!');
    if (process.env.NODE_ENV !== 'test') {
      process.exit(0);
    }
  } catch (error) {
    console.error('Failed to delete shinies:', error);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
}

clearShinies();