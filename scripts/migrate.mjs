// One-shot migration runner: reads every .sql file under lib/db/migrations
// (in filename order) and pipes it at the Postgres endpoint via postgres.js.
// drizzle-kit push/migrate want a TTY; this script is non-interactive and
// safe to call from CI or a CLI agent.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import postgres from 'postgres';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[migrate] DATABASE_URL is not set. Aborting.');
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
const dir = 'lib/db/migrations';
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

try {
  for (const file of files) {
    const raw = readFileSync(join(dir, file), 'utf8');
    // drizzle-kit emits statement breakpoints as a standalone token; split on
    // them and run each statement individually. postgres.js supports multi-
    // statement strings too but per-statement error messages are nicer.
    const statements = raw
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`[migrate] ${file} — ${statements.length} statement(s)`);
    for (const stmt of statements) {
      try {
        await sql.unsafe(stmt);
      } catch (err) {
        const msg = String(err.message || err);
        // Idempotent: skip "already exists" if the migration ran before.
        if (/already exists|duplicate/i.test(msg)) {
          console.log(`  skip: ${stmt.split('\n')[0].slice(0, 60)}…`);
          continue;
        }
        console.error(`  FAIL: ${stmt.split('\n')[0].slice(0, 60)}…`);
        console.error(`  ${msg}`);
        process.exit(1);
      }
    }
  }
  console.log('[migrate] done.');
} finally {
  await sql.end({ timeout: 5 });
}
