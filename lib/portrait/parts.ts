import type { SlotName } from './types';

/**
 * Slot-variant registry. Every ASCII fragment in the portrait lives here
 * as a string[]; the renderer glues them together with newlines. Aligned
 * by hand so crown / body / base_cap line up when stacked.
 *
 * `body` contains the substitution markers:
 *   - `E` — the live eye glyph (violet). Each `E` in the body is replaced
 *     independently by the Mascot component with the current mode's eye.
 *   - `M` — a 5-char mouth slot. Replaced with the mode-specific mouth.
 *
 * No other slot should contain `E` or `M`; those are reserved.
 */
export const PARTS: Record<SlotName, Record<string, ReadonlyArray<string>>> = {
  overhead: {
    none: [],
    'aureole-3': ['     · ◆ · ◆ · ◆ ·'],
  },

  antenna: {
    none: [],
    dot: ['         ·│·'],
  },

  crown: {
    'round-light':  ['    ╭─────────────╮'],
    'round-heavy':  ['    ╭═════════════╮'],
    'square-heavy': ['    ╔═════════════╗'],
  },

  body: {
    default: [
      '   ╱               ╲',
      '  ╱   ┌─┐     ┌─┐   ╲',
      ' │    │E│     │E│    │',
      ' │    └─┘     └─┘    │',
      '  ╲                 ╱',
      '   │      M      │',
    ],
    // The narrow silhouette used by the sentinel cosmetic. Kept slot-
    // compatible so it can share inner_jaw / base_cap / neck / base_plate
    // variants sized to match.
    narrow: [
      '     ╱           ╲',
      '    ╱   ┌─┐ ┌─┐   ╲',
      '    │   │E│ │E│   │',
      '    │   └─┘ └─┘   │',
      '     ╲           ╱',
      '      │    M    │',
    ],
  },

  inner_jaw: {
    none: [],
    light:         ['   │   ╲_______╱    │'],
    heavy:         ['   │   ╲═══════╱    │'],
    'light-narrow': ['      │  ╲___╱   │'],
  },

  base_cap: {
    'round-light':        ['    ╲_____________╱'],
    'round-heavy':        ['    ╲═════════════╱'],
    'square-heavy':       ['    ╚═════════════╝'],
    'round-light-narrow': ['       ╲_________╱'],
  },

  neck: {
    none: [],
    'five-strut':  ['        │ │││ │'],
    'three-strut': ['         │ │ │'],
  },

  base_plate: {
    none: [],
    thin:          ['       ═╧═╧═╧═╧═'],
    wide:          ['     ══╧═╧═╧═╧═══'],
    'thin-narrow': ['        ═╧═╧═'],
  },

  under: {
    none: [],
    'roots-classic': [
      '      ╱  ╲ ╱  ╲',
      '     ╱    ╳    ╲',
      '    ─┴─  ─┴─  ─┴─',
    ],
  },
};
