import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

let cached: DbClient | null = null;

/**
 * Lazy-init Drizzle + Neon HTTP driver. Module-level eval would throw at
 * Next.js build time when DATABASE_URL isn't set; deferring to first use
 * means static routes and the home page still build cleanly when only the
 * API surface depends on Postgres.
 */
export function getDb(): DbClient {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Provision a Postgres DB (Neon via Vercel) and add it to the env.',
    );
  }
  cached = drizzle(neon(url), { schema });
  return cached;
}
