/**
 * Database Adapter Factory
 *
 * Returns the appropriate adapter based on DB_DRIVER env var.
 * SQLite for development, PostgreSQL for production (Phase 4).
 */

import { createSqliteAdapter } from './sqliteAdapter.js';

const DB_DRIVER = String(
  process.env.DB_DRIVER || 'sqlite'
).toLowerCase();

let adapter;

if (DB_DRIVER === 'sqlite') {
  const { default: rawDb } = await import('./connection.js');
  adapter = createSqliteAdapter(rawDb);
} else {
  throw new Error(`Unknown DB_DRIVER: ${DB_DRIVER}. Currently only 'sqlite' is supported.`);
}

export default adapter;
