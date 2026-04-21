import { type NextRequest, NextResponse } from 'next/server';
import { getOrCreateDevOperator, softForget } from '@/lib/db/ledger';

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
    const op = await getOrCreateDevOperator();
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
