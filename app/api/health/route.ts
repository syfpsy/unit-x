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

  // LLM provider (primary name LLM_API_KEY; legacy DEEPSEEK_API_KEY
  // still accepted for in-place rollouts).
  if (process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY) {
    checks.llm_env = 'ok';
  } else {
    checks.llm_env = 'missing LLM_API_KEY';
    status = 503;
  }

  // Embeddings provider — optional. RAG degrades to recency when
  // absent, so this is informational only.
  checks.embeddings = process.env.OPENAI_API_KEY
    ? 'ok'
    : 'disabled (no OPENAI_API_KEY; RAG falls back to recency)';

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
