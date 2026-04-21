import type { OwnerCtx, UnlockRule } from './types';

/**
 * Pure unlock rule evaluator. No IO. Add new rule types here and in
 * `types.ts`; callers keep evaluating via this single switch.
 */
export function isUnlocked(rule: UnlockRule, ctx: OwnerCtx): boolean {
  switch (rule.type) {
    case 'always':
      return true;
    case 'tenure_days':
      return ctx.tenureDays >= rule.min;
    case 'memories_total':
      return ctx.memoriesTotal >= rule.min;
    case 'memories_by_tag':
      return (ctx.memoriesByTag[rule.tag] ?? 0) >= rule.min;
    case 'stage_reached':
      return ctx.evolutionStage >= rule.stage;
  }
}

/**
 * A short human-readable hint shown under a locked cosmetic in the
 * gallery UI. Returned null if already unlocked — nothing to hint.
 */
export function lockHintFor(rule: UnlockRule, ctx: OwnerCtx): string | null {
  if (isUnlocked(rule, ctx)) return null;
  switch (rule.type) {
    case 'always':
      return null;
    case 'tenure_days': {
      const remaining = Math.max(0, rule.min - ctx.tenureDays);
      return `unlocks on day ${rule.min} · ${remaining}d remaining`;
    }
    case 'memories_total': {
      const remaining = Math.max(0, rule.min - ctx.memoriesTotal);
      return `unlocks at ${rule.min} ledger entries · ${remaining} to go`;
    }
    case 'memories_by_tag': {
      const have = ctx.memoriesByTag[rule.tag] ?? 0;
      const remaining = Math.max(0, rule.min - have);
      return `unlocks at ${rule.min} [${rule.tag}] entries · ${remaining} to go`;
    }
    case 'stage_reached': {
      return `unlocks at stage ${rule.stage}`;
    }
  }
}
