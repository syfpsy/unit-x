import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

let cachedSql: ReturnType<typeof postgres> | null = null;
let cachedDb: DbClient | null = null;

/**
 * Lazy-init Drizzle + postgres.js. Supabase + Vercel serverless friendly:
 *   - `prepare: false` avoids prepared-statement caching conflicts with
 *     the connection pooler (pgBouncer transaction mode) that Supabase
 *     uses by default.
 *   - Eager import at module level would throw during `next build` when
 *     DATABASE_URL is unset; deferring to first use lets static routes
 *     build cleanly.
 */
export function getDb(): DbClient {
  if (cachedDb) return cachedDb;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Provision Postgres via Vercel → Supabase integration, then vercel env pull.',
    );
  }
  cachedSql = postgres(url, {
    prepare: false,
    // one shared client per runtime worker — serverless-friendly
    max: 1,
  });
  cachedDb = drizzle(cachedSql, { schema });
  return cachedDb;
}
