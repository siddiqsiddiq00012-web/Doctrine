import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runMigrations() {
  if (process.env.VERCEL || process.env.TURSO_DATABASE_URL) {
    console.log('[Migrations] Skipping synchronous local migrations on Vercel serverless environment.');
    return;
  }
  try {
    const migrationsFolder = path.resolve(__dirname, '../../drizzle');
    console.log('Running database migrations from:', migrationsFolder);
    migrate(db, { migrationsFolder });
    console.log('Database migrations completed successfully.');
  } catch (error) {
    console.error('Failed to run database migrations:', error);
    // Non-fatal warning log if migration folder missing in production
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations();
}
