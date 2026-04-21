import { NextResponse } from 'next/server';
import { getOperator } from '@/lib/auth/getOperator';
import { evolutionForOperator } from '@/lib/db/evolution';
import { listActiveMemories } from '@/lib/db/ledger';
import { galleryFor, ownerCtxFrom } from '@/lib/db/cosmetics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pure read — returns the current ownership state for the operator's
 * gallery. Unlock detection + persistence happens in /api/ledger during
 * load, so opening the gallery never needs to mutate state.
 */
export async function GET() {
  try {
    const op = await getOperator();
    if (!op) return NextResponse.json({ entries: [] });
    const mems = await listActiveMemories(op.id);
    const evo = await evolutionForOperator(op.id, op.createdAt);
    const ctx = ownerCtxFrom({
      tenureDays: evo.state.tenureDays,
      activeMemories: mems,
      evolutionStage: evo.state.stage,
    });
    const entries = await galleryFor(op.id, ctx);
    return NextResponse.json({ entries });
  } catch (err) {
    return NextResponse.json(
      { entries: [], error: String((err as Error).message || err) },
      { status: 500 },
    );
  }
}
