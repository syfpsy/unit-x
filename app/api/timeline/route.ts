import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getOperator } from '@/lib/auth/getOperator';
import { getDb } from '@/lib/db/client';
import { cosmetics, operatorCosmetics, stageTransitions } from '@/lib/db/schema';
import { STAGES } from '@/lib/evolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Unified artifact view. Three sources today, easy to extend:
 *   - `bound`       → the operator's first-seen timestamp.
 *   - `stage-up`    → one row per `stage_transitions` entry.
 *   - `cosmetic`    → one row per `operator_cosmetics` unlock.
 * Future sources can add entries as long as they share the same shape.
 */
export interface TimelineEntry {
  kind: 'bound' | 'stage-up' | 'cosmetic';
  at: number; // epoch ms
  title: string;
  blurb: string;
  accent?: 'violet' | 'phosphor'; // rendering hint
  meta?: Record<string, string | number>;
}

export async function GET() {
  const op = await getOperator();
  if (!op) return NextResponse.json({ entries: [] });

  const db = getDb();
  const [stages, owned] = await Promise.all([
    db
      .select()
      .from(stageTransitions)
      .where(eq(stageTransitions.operatorId, op.id))
      .orderBy(desc(stageTransitions.reachedAt)),
    db
      .select({
        unlockedAt: operatorCosmetics.unlockedAt,
        slug: cosmetics.slug,
        kind: cosmetics.kind,
        name: cosmetics.name,
        blurb: cosmetics.blurb,
      })
      .from(operatorCosmetics)
      .innerJoin(cosmetics, eq(cosmetics.id, operatorCosmetics.cosmeticId))
      .where(eq(operatorCosmetics.operatorId, op.id))
      .orderBy(desc(operatorCosmetics.unlockedAt)),
  ]);

  const entries: TimelineEntry[] = [];

  // The "first binding" entry — always first chronologically. We render
  // it with a violet accent so it's visually distinct from stage-ups.
  entries.push({
    kind: 'bound',
    at: op.createdAt.getTime(),
    title: 'operator bound',
    blurb: `${op.handle} · /soul/${op.handle}.md opened for the first time`,
    accent: 'violet',
  });

  for (const s of stages) {
    const def = STAGES.find((d) => d.stage === s.stage);
    if (!def) continue;
    entries.push({
      kind: 'stage-up',
      at: s.reachedAt.getTime(),
      title: `stage reached · ${def.title}`,
      blurb: def.blurb,
      accent: 'violet',
      meta: { stage: s.stage },
    });
  }

  for (const o of owned) {
    entries.push({
      kind: 'cosmetic',
      at: o.unlockedAt.getTime(),
      title: `unlocked · ${o.name}`,
      blurb: `${o.kind.replace('_', ' ')} · ${o.blurb}`,
      meta: { slug: o.slug, kind: o.kind },
    });
  }

  // Reverse-chronological for the UI (newest at top). The `bound` entry
  // naturally sinks to the bottom because it's the oldest timestamp.
  entries.sort((a, b) => b.at - a.at);

  return NextResponse.json({ entries });
}
