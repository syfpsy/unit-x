import { NextResponse } from 'next/server';
import { getOperator } from '@/lib/auth/getOperator';
import { listActiveMemories } from '@/lib/db/ledger';
import { evolutionForOperator } from '@/lib/db/evolution';
import type { EvolutionStage, EvolutionState } from '@/lib/evolution';
import type { MemoryTag } from '@/components/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LedgerResponse {
  operator: null | { handle: string; email: string; createdAt: number };
  memories: Array<{
    id: string;
    tag: MemoryTag;
    text: string;
    ts: number;
  }>;
  evolution: EvolutionState | null;
  stageUp: { from: EvolutionStage | -1; to: EvolutionStage } | null;
}

export async function GET() {
  try {
    const op = await getOperator();
    if (!op) {
      const body: LedgerResponse = {
        operator: null,
        memories: [],
        evolution: null,
        stageUp: null,
      };
      return NextResponse.json(body);
    }

    const [rows, evo] = await Promise.all([
      listActiveMemories(op.id),
      evolutionForOperator(op.id, op.createdAt),
    ]);

    const body: LedgerResponse = {
      operator: {
        handle: op.handle,
        email: op.email,
        createdAt: op.createdAt.getTime(),
      },
      memories: rows
        .map((r) => ({
          id: r.id,
          tag: r.tag as MemoryTag,
          text: r.text,
          ts: r.createdAt.getTime(),
        }))
        // Client needs chronological (oldest-first) so slice(-20) returns recent.
        .reverse(),
      evolution: evo.state,
      stageUp: evo.stageUp,
    };
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json(
      {
        operator: null,
        memories: [],
        evolution: null,
        stageUp: null,
        error: String((err as Error).message || err),
      },
      { status: 500 },
    );
  }
}
