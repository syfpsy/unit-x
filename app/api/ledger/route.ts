import { NextResponse } from 'next/server';
import { getOperator } from '@/lib/auth/getOperator';
import { listActiveMemories } from '@/lib/db/ledger';
import { evolutionForOperator } from '@/lib/db/evolution';
import {
  detectAndPersistUnlocks,
  equippedFor,
  ownerCtxFrom,
} from '@/lib/db/cosmetics';
import type { CosmeticPayload } from '@/lib/cosmetics/types';
import type { EvolutionStage, EvolutionState } from '@/lib/evolution';
import type { MemoryTag } from '@/components/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LedgerResponse {
  operator: null | { handle: string; email: string; createdAt: number };
  memories: Array<{ id: string; tag: MemoryTag; text: string; ts: number }>;
  evolution: EvolutionState | null;
  stageUp: { from: EvolutionStage | -1; to: EvolutionStage } | null;
  equipped: Record<string, { slug: string; name: string; payload: CosmeticPayload }>;
  newlyUnlockedSlugs: string[];
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
        equipped: {},
        newlyUnlockedSlugs: [],
      };
      return NextResponse.json(body);
    }

    const [rows, evo] = await Promise.all([
      listActiveMemories(op.id),
      evolutionForOperator(op.id, op.createdAt),
    ]);

    const ctx = ownerCtxFrom({
      tenureDays: evo.state.tenureDays,
      activeMemories: rows,
      evolutionStage: evo.state.stage,
    });
    const newlyUnlockedSlugs = await detectAndPersistUnlocks(op.id, ctx);
    const equippedRaw = await equippedFor(op.id);
    const equipped: LedgerResponse['equipped'] = {};
    for (const [kind, row] of Object.entries(equippedRaw)) {
      equipped[kind] = {
        slug: row.slug,
        name: row.name,
        payload: row.payload,
      };
    }

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
        .reverse(),
      evolution: evo.state,
      stageUp: evo.stageUp,
      equipped,
      newlyUnlockedSlugs,
    };
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json(
      {
        operator: null,
        memories: [],
        evolution: null,
        stageUp: null,
        equipped: {},
        newlyUnlockedSlugs: [],
        error: String((err as Error).message || err),
      },
      { status: 500 },
    );
  }
}
