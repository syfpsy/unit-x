// Phase 5/8 tooling: after a soft-deleted memory has sat for longer than
// the grace period (default 30 days), overwrite its ciphertext and nonce
// with zeros. This makes /forget irreversible at rest — not just a
// tombstone — while keeping the grace window so users can recover from
// mistakes via support.
//
// Not scheduled from Phase 5 itself. Run on demand; Phase 8 wires it up
// as a daily Vercel cron or a Supabase scheduled function.
//
// Usage: node scripts/retention-sweep.mjs [--grace-days=30] [--dry-run]

import { config as loadEnv } from 'dotenv';
import postgres from 'postgres';

loadEnv({ path: '.env.local' });

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  }),
);
const graceDays = Number(args.get('grace-days') ?? 30);
const dryRun = args.get('dry-run') === 'true';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Aborting.');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const zeros = Buffer.alloc(1);

try {
  const expired = await sql`
    select id from memories
    where deleted_at is not null
      and deleted_at < now() - make_interval(days => ${graceDays})
      and octet_length(text_cipher) > 1
  `;
  console.log(
    `[retention] ${expired.length} memories past ${graceDays}d grace ${
      dryRun ? '(dry run)' : ''
    }`,
  );
  if (!dryRun && expired.length > 0) {
    const ids = expired.map((r) => r.id);
    await sql`
      update memories
      set text_cipher = ${zeros}, nonce = ${zeros}
      where id = any(${ids}::uuid[])
    `;
    console.log(`[retention] wiped ${expired.length} rows`);
  }

  // Same treatment for messages: messages don't have a deleted_at column yet,
  // so for now only memories are eligible. When Phase 8 adds retention for
  // messages (e.g. cold-archive after 2 years) we extend this sweep.
} finally {
  await sql.end({ timeout: 5 });
}
