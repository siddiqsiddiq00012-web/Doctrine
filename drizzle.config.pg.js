import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/db/schema.pg.js',
  out: './drizzle/pg',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL || process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/doctrine',
  },
});
