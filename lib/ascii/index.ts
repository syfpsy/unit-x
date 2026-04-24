/**
 * Public surface for the ASCII animation engine. Import from
 * `@/lib/ascii` rather than the individual files.
 *
 *   import { useAsciiFrame, scan, rain, layer } from '@/lib/ascii';
 *
 * See each module for docs on what's in scope.
 */

export {
  type CellFn,
  render,
  layer,
  overwrite,
  sprite,
  mask,
  hash,
  lerp,
  clamp,
  rampChar,
} from './engine';

export {
  type ScanOptions,
  type WaveOptions,
  type RainOptions,
  type StarsOptions,
  type PulseOptions,
  type ShiverOptions,
  type RingOptions,
  scan,
  wave,
  rain,
  stars,
  pulse,
  morph,
  shiver,
  ring,
} from './primitives';

export { useAsciiFrame, type UseAsciiFrameOptions } from './useAsciiFrame';
