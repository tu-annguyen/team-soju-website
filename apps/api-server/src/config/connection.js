const { Pool, types } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

// Force SQL DATE (OID 1082) to be returned as the raw 'YYYY-MM-DD' string.
// This prevents the pg driver from converting DATE -> JS Date (which JSON-serializes to an ISO timestamp).
types.setTypeParser(1082, (val) => val);

function shouldUseSsl() {
  const explicitSsl = (process.env.DB_SSL || '').trim().toLowerCase();
  const sslMode = (process.env.PGSSLMODE || process.env.DB_SSL_MODE || '').trim().toLowerCase();
  const databaseUrl = process.env.DATABASE_URL || '';

  if (['1', 'true', 'yes', 'require', 'required'].includes(explicitSsl)) {
    return true;
  }

  if (['require', 'prefer', 'verify-ca', 'verify-full'].includes(sslMode)) {
    return true;
  }

  if (/sslmode=(require|prefer|verify-ca|verify-full)/i.test(databaseUrl)) {
    return true;
  }

  return process.env.NODE_ENV === 'production';
}

function buildPoolConfig() {
  const ssl = shouldUseSsl() ? { rejectUnauthorized: false } : false;
  const databaseUrl = (process.env.DATABASE_URL || '').trim();

  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      ssl,
    };
  }

  return {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl,
  };
}

const pool = new Pool(buildPoolConfig());

// Test the connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

module.exports = pool;
