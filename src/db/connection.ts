import { Database } from 'bun:sqlite';
import { mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

const DB_PATH = process.env.DB_PATH || './data/sequel-api.db';

let _db: Database | null = null;

export function getDb(): Database {
  if (_db) return _db;

  const dbDir = dirname(resolve(DB_PATH));
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  _db = new Database(resolve(DB_PATH), { create: true });

  // Enable WAL mode
  _db.exec('PRAGMA journal_mode = WAL');
  _db.exec('PRAGMA foreign_keys = ON');

  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
