import { NextResponse } from 'next/server';
import { getOrCreateDevOperator, listActiveMemories } from '@/lib/db/ledger';
import type { MemoryTag } from '@/components/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LedgerResponse {
  memories: Array<{
    id: string;
    tag: MemoryTag;
    text: string;
    ts: number;
  }>;
}

export async function GET() {
  try {
    const op = await getOrCreateDevOperator();
    const rows = await listActiveMemories(op.id);
    const body: LedgerResponse = {
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
      { error: String((err as Error).message || err), memories: [] },
      { status: 500 },
    );
  }
}
