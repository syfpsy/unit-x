import { NextResponse } from 'next/server';
import { getOperator } from '@/lib/auth/getOperator';
import { listActiveMemories } from '@/lib/db/ledger';
import type { MemoryTag } from '@/components/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LedgerResponse {
  operator: null | { handle: string; email: string };
  memories: Array<{
    id: string;
    tag: MemoryTag;
    text: string;
    ts: number;
  }>;
}

export async function GET() {
  try {
    const op = await getOperator();
    if (!op) {
      // Anonymous / skip-path: no persisted ledger.
      const body: LedgerResponse = { operator: null, memories: [] };
      return NextResponse.json(body);
    }
    const rows = await listActiveMemories(op.id);
    const body: LedgerResponse = {
      operator: { handle: op.handle, email: op.email },
      memories: rows
        .map((r) => ({
          id: r.id,
          tag: r.tag as MemoryTag,
          text: r.text,
          ts: r.createdAt.getTime(),
        }))
        // DB returns newest-first; client expects chronological (oldest-first)
        // since it slices the tail with slice(-20) when building the prompt.
        .reverse(),
    };
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json(
      { operator: null, memories: [], error: String((err as Error).message || err) },
      { status: 500 },
    );
  }
}
