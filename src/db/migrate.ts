import { getDb } from './connection.js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function runMigrations(): void {
  const db = getDb();
  const schemaPath = resolve(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  // Execute the entire schema
  db.exec(schema);

  console.log('✅ Database migrations complete');
}

runMigrations();
