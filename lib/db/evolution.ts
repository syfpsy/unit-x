import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { getDb } from './client';
import { memories, messages, stageTransitions } from './schema';
import {
  computeEvolution,
  type EvolutionInput,
  type EvolutionStage,
  type EvolutionState,
} from '@/lib/evolution';

/**
 * Server-side evolution pipeline:
 *   1. Fetch tenure inputs (operator.createdAt, active memory count, last message ts).
 *   2. Run the pure compute.
 *   3. Compare to the highest stage already recorded for this operator.
 *      Insert rows for any unseen stages up to and including the current
 *      one (handles jumps, e.g. an import that lands someone at stage 3).
 *   4. Return the state + a `stageUp` descriptor iff at least one new row
 *      was written. The client uses that to fire the one-shot celebration.
 */
export interface EvolutionForOperator {
  state: EvolutionState;
  stageUp: { from: EvolutionStage | -1; to: EvolutionStage } | null;
}

export async function evolutionForOperator(operatorId: string, createdAt: Date): Promise<EvolutionForOperator> {
  const db = getDb();

  const [lastMsg] = await db
    .select({ ts: messages.ts })
    .from(messages)
    .where(and(eq(messages.operatorId, operatorId), eq(messages.who, 'user')))
    .orderBy(desc(messages.ts))
    .limit(1);

  const activeMems = await db
    .select({ id: memories.id })
    .from(memories)
    .where(and(eq(memories.operatorId, operatorId), isNull(memories.deletedAt)));

  const input: EvolutionInput = {
    createdAt,
    activeMemoryCount: activeMems.length,
    lastInteractionAt: lastMsg?.ts ?? null,
  };
  const state = computeEvolution(input);

  // Check recorded transitions.
  const existing = await db
    .select({ stage: stageTransitions.stage })
    .from(stageTransitions)
    .where(eq(stageTransitions.operatorId, operatorId))
    .orderBy(desc(stageTransitions.stage))
    .limit(1);
  const prevStage: EvolutionStage | -1 = existing.length > 0 ? (existing[0].stage as EvolutionStage) : -1;

  let stageUp: EvolutionForOperator['stageUp'] = null;
  if (state.stage > prevStage) {
    const toInsert = [];
    for (let s = prevStage + 1; s <= state.stage; s++) {
      toInsert.push({ operatorId, stage: s });
    }
    if (toInsert.length > 0) {
      // `onConflictDoNothing` guards against parallel tab races.
      await db.insert(stageTransitions).values(toInsert).onConflictDoNothing();
    }
    stageUp = { from: prevStage, to: state.stage };
  }

  return { state, stageUp };
}
