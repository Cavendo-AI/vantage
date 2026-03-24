import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Initialize database schema.
 * @param {object} db - Database adapter
 */
export async function initializeDatabase(db) {
  if (db.dialect === 'sqlite') {
    await db.run('PRAGMA foreign_keys = ON');
  }

  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await db.run(schema);

  const DB_PATH = process.env.DATABASE_PATH || join(__dirname, '../../data/vantage.db');
  console.log('Database initialized at:', DB_PATH);
}

// Run standalone
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { createSqliteAdapter } = await import('./sqliteAdapter.js');
  const Database = (await import('better-sqlite3')).default;
  const DB_PATH = process.env.DATABASE_PATH || join(__dirname, '../../data/vantage.db');
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const raw = new Database(DB_PATH);
  raw.pragma('journal_mode = WAL');
  const db = createSqliteAdapter(raw);
  initializeDatabase(db).then(() => {
    db.close();
    console.log('Done.');
  }).catch(err => {
    console.error('Failed:', err);
    db.close();
    process.exit(1);
  });
}
