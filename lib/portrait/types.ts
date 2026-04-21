/**
 * Phase 10 — slot-based portrait system.
 *
 * The mascot is a vertical composition of named slots. Each slot has a
 * registry of variants (in `lib/portrait/parts.ts`); a `PortraitSpec`
 * assigns one variant slug per slot. The renderer concatenates slot
 * outputs in a fixed order.
 *
 * ASCII doesn't compose arbitrarily — characters are fixed-width and
 * must align spatially. We side-step that by making each variant a set
 * of pre-aligned whole lines. Slots that "share a row" (e.g. eyes and
 * mouth both live inside the face) are bundled into a single atomic
 * `body` variant; slots that are vertically separable (crown, antenna,
 * aureole, base plate, roots) are their own.
 */

export type SlotName =
  | 'overhead'     // aureole / earned crown ornamentation (0-2 lines)
  | 'antenna'      // single upward strut (0-1 line)
  | 'crown'        // top border of the head (1 line)
  | 'body'         // face silhouette + eye rows + mouth (6 lines, atomic)
  | 'inner_jaw'    // small curl inside the face bottom (0-1 line)
  | 'base_cap'     // bottom border of the head (1 line)
  | 'neck'         // struts between head and base (0-1 line)
  | 'base_plate'   // tap pattern below the neck (0-1 line)
  | 'under';       // roots, platform, environmental glyphs (0-N lines)

/**
 * Order is the render order, top to bottom. Do not reorder casually — it
 * will break every existing stage preset and every cosmetic that relies
 * on vertical adjacency.
 */
export const SLOT_ORDER: ReadonlyArray<SlotName> = [
  'overhead',
  'antenna',
  'crown',
  'body',
  'inner_jaw',
  'base_cap',
  'neck',
  'base_plate',
  'under',
];

export interface PortraitSpec {
  /** slot name → variant slug from `lib/portrait/parts.ts`. */
  slots: Partial<Record<SlotName, string>>;
}
