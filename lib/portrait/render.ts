import { PARTS } from './parts';
import { SLOT_ORDER, type PortraitSpec, type SlotName } from './types';

/**
 * Render a `PortraitSpec` into a single template string (with `E` and
 * `M` markers for the Mascot component to substitute). Unknown variants
 * are silently skipped so a typo in a cosmetic payload doesn't crash
 * the whole render.
 *
 * Trailing newline is included so callers can safely concatenate.
 */
export function renderPortrait(spec: PortraitSpec): string {
  const lines: string[] = [];
  for (const slot of SLOT_ORDER) {
    const variant = spec.slots[slot];
    if (!variant) continue;
    const partLines = PARTS[slot as SlotName]?.[variant];
    if (!partLines) continue;
    for (const line of partLines) lines.push(line);
  }
  return lines.join('\n') + '\n';
}

/**
 * Combine a base spec with an overlay, overlay keys winning. Used to
 * apply cosmetic slot overrides on top of stage defaults.
 */
export function mergeSpecs(base: PortraitSpec, overlay: PortraitSpec): PortraitSpec {
  return {
    slots: { ...base.slots, ...overlay.slots },
  };
}
