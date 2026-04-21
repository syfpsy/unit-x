import { type NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { sql as rawSql } from 'drizzle-orm';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Daily retention sweep. Matches scripts/retention-sweep.mjs: any memory
 * whose soft-delete is older than the grace period gets its ciphertext
 * and nonce overwritten with a single zero byte. The tombstone row stays
 * so /export still shows "[forgotten on …]"; the content becomes
 * unrecoverable.
 *
 * Vercel calls this on a schedule defined in vercel.json. It's gated by
 * the CRON_SECRET header so a stranger can't hammer it — Vercel sets the
 * Authorization header automatically for Vercel Cron.
 */
const GRACE_DAYS = 30;

export async function GET(req: NextRequest) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>. Reject anything
  // that doesn't carry it when the secret is configured.
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const got = req.headers.get('authorization');
    if (got !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  try {
    const db = getDb();
    const result = await db.execute(rawSql`
      update memories
      set text_cipher = '\\x00'::bytea, nonce = '\\x00'::bytea
      where deleted_at is not null
        and deleted_at < now() - make_interval(days => ${GRACE_DAYS})
        and octet_length(text_cipher) > 1
      returning id
    `);
    // postgres.js execute() returns an array-like; count rows affected
    const count = Array.isArray(result) ? result.length : 0;
    log.info('retention sweep', { graceDays: GRACE_DAYS, wiped: count });
    return NextResponse.json({ ok: true, wiped: count, graceDays: GRACE_DAYS });
  } catch (err) {
    log.error('retention sweep failed', { err });
    return NextResponse.json({ error: 'sweep failed' }, { status: 500 });
  }
}
