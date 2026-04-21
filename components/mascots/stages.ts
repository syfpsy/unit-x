import type { EvolutionStage } from '@/lib/evolution';

/**
 * ASCII mascot variants, one per evolution stage. The rendered string has
 * two substitution markers that the Mascot component fills in:
 *   - `E` (each instance replaced with the live eye glyph)
 *   - `M` (single instance replaced with the mouth glyph, 5 chars)
 *
 * Each template keeps the same silhouette so the face stays recognisable.
 * Extra details accumulate upward (antenna, aureole) and laterally
 * (refined borders, tether points on the base). No colour decisions live
 * here — colour comes from CSS (eyes = violet, rest = phosphor).
 */
export type MascotTemplate = string;

const STAGE_0: MascotTemplate = `
    ╭─────────────╮
   ╱               ╲
  ╱   ┌─┐     ┌─┐   ╲
 │    │E│     │E│    │
 │    └─┘     └─┘    │
  ╲                 ╱
   │      M      │
    ╲_____________╱
`.replace(/^\n/, '');

const STAGE_1: MascotTemplate = `
    ╭─────────────╮
   ╱               ╲
  ╱   ┌─┐     ┌─┐   ╲
 │    │E│     │E│    │
 │    └─┘     └─┘    │
  ╲                 ╱
   │      M      │
   │   ╲_______╱    │
    ╲_____________╱
        │ │││ │
       ═╧═╧╧═╧═
`.replace(/^\n/, '');

const STAGE_2: MascotTemplate = `
         ·│·
    ╭─────────────╮
   ╱               ╲
  ╱   ┌─┐     ┌─┐   ╲
 │    │E│     │E│    │
 │    └─┘     └─┘    │
  ╲                 ╱
   │      M      │
   │   ╲_______╱    │
    ╲_____________╱
        │ │││ │
       ═╧═╧╧═╧═
`.replace(/^\n/, '');

const STAGE_3: MascotTemplate = `
         ·│·
    ╭═════════════╮
   ╱               ╲
  ╱   ┌─┐     ┌─┐   ╲
 │    │E│     │E│    │
 │    └─┘     └─┘    │
  ╲                 ╱
   │      M      │
   │   ╲_______╱    │
    ╲═════════════╱
        │ │││ │
      ══╧═╧╧═╧══
`.replace(/^\n/, '');

const STAGE_4: MascotTemplate = `
      · ·◆·◆· ·
         ·│·
    ╔═════════════╗
   ╱               ╲
  ╱   ┌─┐     ┌─┐   ╲
 │    │E│     │E│    │
 │    └─┘     └─┘    │
  ╲                 ╱
   │      M      │
   │   ╲═══════╱    │
    ╚═════════════╝
        │ │││ │
      ══╧═╧╧═╧══
`.replace(/^\n/, '');

export const MASCOT_BY_STAGE: Record<EvolutionStage, MascotTemplate> = {
  0: STAGE_0,
  1: STAGE_1,
  2: STAGE_2,
  3: STAGE_3,
  4: STAGE_4,
};
