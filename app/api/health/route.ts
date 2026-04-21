import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { sql as rawSql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness + dependency check. Verifies:
 *   - `DATABASE_URL` is reachable (single `select 1`)
 *   - `DEEPSEEK_API_KEY` is set (not a reachability probe — calling
 *     DeepSeek on every health-check would burn the free tier)
 *   - `UNITX_MASTER_KEY` is present and the right length
 *
 * Returns 200 when every check passes, 503 otherwise. Responses are
 * deliberately small so they're cheap to poll on a cron.
 */
export async function GET() {
  const checks: Record<string, 'ok' | string> = {};
  let status = 200;

  // DB
  try {
    const db = getDb();
    await db.execute(rawSql`select 1`);
    checks.db = 'ok';
  } catch (err) {
    checks.db = String((err as Error).message || err).slice(0, 120);
    status = 503;
  }

  // DeepSeek env
  if (process.env.DEEPSEEK_API_KEY) {
    checks.deepseek_env = 'ok';
  } else {
    checks.deepseek_env = 'missing DEEPSEEK_API_KEY';
    status = 503;
  }

  // Master key
  const key = process.env.UNITX_MASTER_KEY;
  if (!key) {
    checks.master_key = 'missing';
    status = 503;
  } else if (Buffer.from(key, 'base64').length !== 32) {
    checks.master_key = 'wrong length';
    status = 503;
  } else {
    checks.master_key = 'ok';
  }

  return NextResponse.json(
    { status: status === 200 ? 'ok' : 'degraded', checks },
    { status },
  );
}
