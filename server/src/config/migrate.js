const fs = require('fs');
const path = require('path');
const pool = require('./connection');

async function runMigrations() {
  try {
    console.log('Running database migrations...');
    
    const schemaPath = path.join(__dirname, '../models/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await pool.query(schema);
    console.log('Database migrations completed successfully!');
    
    if (process.env.NODE_ENV !== 'test') {
      process.exit(0);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
}

runMigrations();