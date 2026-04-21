import { type NextRequest, NextResponse } from 'next/server';
import { getOperator } from '@/lib/auth/getOperator';
import { softForget } from '@/lib/db/ledger';
import { checkRateLimit } from '@/lib/ratelimit';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ForgetBody {
  keyword: string;
}

export async function POST(req: NextRequest) {
  let body: ForgetBody;
  try {
    body = (await req.json()) as ForgetBody;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const keyword = (body.keyword || '').trim();
  if (!keyword) {
    return NextResponse.json({ error: 'keyword required' }, { status: 400 });
  }

  try {
    const op = await getOperator();
    if (!op) {
      // Nothing to forget for an anonymous session.
      return NextResponse.json({ forgotten: [] });
    }
    // Destructive route — keep it tight. 5 burst, 1 per 10s sustained.
    const rl = checkRateLimit(`forget:${op.id}`, { capacity: 5, refillPerSec: 0.1 });
    if (!rl.allowed) {
      log.warn('forget rate-limited', { op: op.id, retryMs: rl.retryAfterMs });
      return NextResponse.json(
        { error: `rate limited — retry in ${Math.ceil(rl.retryAfterMs / 1000)}s` },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }
    const removedRows = await softForget({ operatorId: op.id, keyword });
    return NextResponse.json({
      forgotten: removedRows.map((r) => ({
        id: r.id,
        tag: r.tag,
        text: r.text,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: String((err as Error).message || err) },
      { status: 500 },
    );
  }
}
