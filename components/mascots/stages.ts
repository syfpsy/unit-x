import type { EvolutionStage } from '@/lib/evolution';

/**
 * ASCII mascot variants, one per evolution stage. The rendered string has
 * two substitution markers that the Mascot component fills in:
 *   - `E` (each instance replaced with the live eye glyph — 1 char)
 *   - `M` (single instance replaced with the mouth glyph — 5 chars)
 *
 * Each template keeps the same silhouette so the face stays recognisable.
 * Additions accumulate upward (antenna, aureole) and in border weight
 * (single-line → heavy double-line). All five share the same neck + base:
 *   neck  = │ │││ │      (5 struts)
 *   base  = ═╧═╧═╧═╧═   (5 taps — Stage 3+ gets ═-padding on each side)
 *
 * Colour comes from CSS (eyes are violet; rest takes the operator's
 * phosphor). Keep that divide — cosmetic overrides can also change the
 * silhouette but the phosphor/violet split is the one invariant.
 */
export type MascotTemplate = string;

// Common neck + base. Kept as a single source of truth so future audits
// don't re-introduce the old `═╧═╧╧═╧═` asymmetry.
const NECK_THIN = `        │ │││ │`;
const BASE_THIN = `       ═╧═╧═╧═╧═`;
const BASE_WIDE = `     ══╧═╧═╧═╧═══`;

const STAGE_0: MascotTemplate = [
  '    ╭─────────────╮',
  '   ╱               ╲',
  '  ╱   ┌─┐     ┌─┐   ╲',
  ' │    │E│     │E│    │',
  ' │    └─┘     └─┘    │',
  '  ╲                 ╱',
  '   │      M      │',
  '    ╲_____________╱',
].join('\n') + '\n';

const STAGE_1: MascotTemplate = [
  '    ╭─────────────╮',
  '   ╱               ╲',
  '  ╱   ┌─┐     ┌─┐   ╲',
  ' │    │E│     │E│    │',
  ' │    └─┘     └─┘    │',
  '  ╲                 ╱',
  '   │      M      │',
  '   │   ╲_______╱    │',
  '    ╲_____________╱',
  NECK_THIN,
  BASE_THIN,
].join('\n') + '\n';

const STAGE_2: MascotTemplate = [
  '         ·│·',
  '    ╭─────────────╮',
  '   ╱               ╲',
  '  ╱   ┌─┐     ┌─┐   ╲',
  ' │    │E│     │E│    │',
  ' │    └─┘     └─┘    │',
  '  ╲                 ╱',
  '   │      M      │',
  '   │   ╲_______╱    │',
  '    ╲_____________╱',
  NECK_THIN,
  BASE_THIN,
].join('\n') + '\n';

const STAGE_3: MascotTemplate = [
  '         ·│·',
  '    ╭═════════════╮',
  '   ╱               ╲',
  '  ╱   ┌─┐     ┌─┐   ╲',
  ' │    │E│     │E│    │',
  ' │    └─┘     └─┘    │',
  '  ╲                 ╱',
  '   │      M      │',
  '   │   ╲═══════╱    │',
  '    ╲═════════════╱',
  NECK_THIN,
  BASE_WIDE,
].join('\n') + '\n';

const STAGE_4: MascotTemplate = [
  '     · ◆ · ◆ · ◆ ·',
  '         ·│·',
  '    ╔═════════════╗',
  '   ╱               ╲',
  '  ╱   ┌─┐     ┌─┐   ╲',
  ' │    │E│     │E│    │',
  ' │    └─┘     └─┘    │',
  '  ╲                 ╱',
  '   │      M      │',
  '   │   ╲═══════╱    │',
  '    ╚═════════════╝',
  NECK_THIN,
  BASE_WIDE,
].join('\n') + '\n';

export const MASCOT_BY_STAGE: Record<EvolutionStage, MascotTemplate> = {
  0: STAGE_0,
  1: STAGE_1,
  2: STAGE_2,
  3: STAGE_3,
  4: STAGE_4,
};
