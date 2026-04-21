import type { EvolutionStage } from '@/lib/evolution';
import { renderPortrait } from '@/lib/portrait/render';
import { STAGE_SPECS } from '@/lib/portrait/stages';

/**
 * Legacy re-export: `MASCOT_BY_STAGE[stage]` returns the pre-rendered
 * template string for the stage. Since Phase 10 the actual source of
 * truth is `STAGE_SPECS` (slot assignments) + `PARTS` (slot variants);
 * this map is computed once at import time and kept for any callers
 * that only need a fully-rendered string.
 *
 * Prefer `renderPortrait(STAGE_SPECS[stage])` in new code — it composes
 * cleanly with cosmetic slot overrides.
 */
export type MascotTemplate = string;

export const MASCOT_BY_STAGE: Record<EvolutionStage, MascotTemplate> =
  Object.fromEntries(
    (Object.entries(STAGE_SPECS) as Array<[string, (typeof STAGE_SPECS)[EvolutionStage]]>).map(
      ([k, v]) => [Number(k) as EvolutionStage, renderPortrait(v)] as const,
    ),
  ) as Record<EvolutionStage, MascotTemplate>;
