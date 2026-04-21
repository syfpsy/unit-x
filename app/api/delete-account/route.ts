import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { getOperator } from '@/lib/auth/getOperator';
import { getDb } from '@/lib/db/client';
import { operators } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/ratelimit';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DeleteBody {
  confirm: string;
}

/**
 * Hard-delete the operator's data. Requires a typed confirmation string
 * (`DELETE MY SOUL`) so it can't be triggered by a random POST. The
 * cascade from `operators` wipes `messages`, `memories`, and
 * `operator_cosmetics`; we also call Supabase Auth admin to delete the
 * auth.users row (which would also cascade on its own, but explicit is
 * clearer and kills active sessions immediately).
 */
export async function POST(req: NextRequest) {
  let body: DeleteBody;
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (body.confirm !== 'DELETE MY SOUL') {
    return NextResponse.json(
      { error: 'confirmation phrase must be exactly "DELETE MY SOUL"' },
      { status: 400 },
    );
  }

  const op = await getOperator();
  if (!op) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // One per minute, no burst — destructive + irreversible.
  const rl = checkRateLimit(`delete-account:${op.id}`, { capacity: 1, refillPerSec: 1 / 60 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `rate limited — retry in ${Math.ceil(rl.retryAfterMs / 1000)}s` },
      { status: 429 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) {
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 });
  }
  const admin = createClient(url, svc, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Belt + suspenders: delete our operator row first (cascades to
    // messages, memories, operator_cosmetics, stage_transitions), then
    // delete the auth.users row to kill sessions and avoid a dangling
    // auth entry.
    const db = getDb();
    await db.delete(operators).where(eq(operators.id, op.id));
    const { error } = await admin.auth.admin.deleteUser(op.authUserId);
    if (error) {
      log.error('delete-account auth deletion failed', {
        authUserId: op.authUserId,
        err: error.message,
      });
      // Data is already gone; auth row is still there. Fail loud so the
      // user can report and we can clean up manually.
      return NextResponse.json(
        { error: 'partial delete — data removed, auth removal failed' },
        { status: 500 },
      );
    }
    log.info('delete-account success', { handle: op.handle });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error('delete-account failed', { err });
    return NextResponse.json({ error: 'delete failed' }, { status: 500 });
  }
}
