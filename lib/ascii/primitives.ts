/**
 * Library of reusable `CellFn` primitives. Each one returns a
 * configured animation you can drop into an `AsciiField` or layer
 * underneath others.
 *
 * Primitive design rules:
 *   - Configuration comes in via a factory; the returned CellFn is
 *     pure over (t, x, y, W, H).
 *   - Sensible defaults. Most primitives should look good with
 *     `scanline()` and no args.
 *   - Monospace-friendly glyphs only — no double-width, no emoji.
 *   - Chars chosen from the CRT / retro-terminal palette so they
 *     mesh with UNIT-X's existing ASCII vocabulary.
 */

import { type CellFn, hash, rampChar } from './engine';

/* -------------------------------------------------------------------------- */
/*  Sweeping scanline — "thinking" / uplink states                            */
/* -------------------------------------------------------------------------- */

export interface ScanOptions {
  /** Cells per second the wave travels across the grid. */
  speed?: number;
  /** Brightness ramp. Darkest → brightest. */
  ramp?: string;
  /** Vertical direction instead of horizontal. */
  vertical?: boolean;
  /** Width of the bright band in cells. Wider = softer. */
  bandwidth?: number;
}

/**
 * Soft sweeping gradient — looks like a radar line crossing the field.
 * Default is horizontal left-to-right at ~15 cells/sec.
 */
export function scan(opts: ScanOptions = {}): CellFn {
  const speed = opts.speed ?? 15;
  const ramp = opts.ramp ?? ' ·:-=+*#';
  const vertical = opts.vertical ?? false;
  const bw = opts.bandwidth ?? 4;
  return (t, x, y, W, H) => {
    const pos = vertical ? y : x;
    const span = vertical ? H : W;
    // head travels 0 → span+bw so the band clears the edge before wrapping
    const head = ((t * speed) % (span + bw * 2)) - bw;
    const d = Math.abs(pos - head);
    if (d > bw) return ' ';
    const brightness = 1 - d / bw;
    return rampChar(ramp, brightness);
  };
}

/* -------------------------------------------------------------------------- */
/*  Sine wave — idle breathing horizons                                       */
/* -------------------------------------------------------------------------- */

export interface WaveOptions {
  amplitude?: number;
  frequency?: number;
  speed?: number;
  char?: string;
  thickness?: number;
}

/** Single sine-wave line bobbing through the middle of the grid. */
export function wave(opts: WaveOptions = {}): CellFn {
  const amp = opts.amplitude ?? 2;
  const freq = opts.frequency ?? 0.2;
  const speed = opts.speed ?? 1.2;
  const char = opts.char ?? '~';
  const thick = opts.thickness ?? 0.7;
  return (t, x, y, _W, H) => {
    const waveY = H / 2 + Math.sin(x * freq + t * speed) * amp;
    return Math.abs(y - waveY) <= thick ? char : ' ';
  };
}

/* -------------------------------------------------------------------------- */
/*  Matrix rain — dreaming / reverie                                          */
/* -------------------------------------------------------------------------- */

export interface RainOptions {
  /** Approximate proportion of columns carrying drops [0..1]. */
  density?: number;
  /** Characters pooled for drop bodies + heads. */
  chars?: string;
  /** Random seed so renders stay stable between remounts. */
  seed?: number;
  /** Overall speed multiplier. */
  speed?: number;
  /** Length of each drop's trail. */
  trail?: number;
}

/**
 * Soft matrix-style rain. Drops fall in fixed columns; head is always
 * brighter than the trail. Seeded so remounts look identical rather
 * than shuffling.
 */
export function rain(opts: RainOptions = {}): CellFn {
  const density = opts.density ?? 0.35;
  const chars = opts.chars ?? '|│¦.`·';
  const seed = opts.seed ?? 1;
  const speed = opts.speed ?? 1;
  const trail = opts.trail ?? 5;

  // Column metadata is cached per grid width — avoids re-seeding on
  // every frame. We key on the seed + a placeholder width; the actual
  // W is passed in, so we recompute on the first frame of a new width.
  let cachedW = -1;
  let cols: Array<{ active: boolean; speed: number; offset: number; charIdx: number }> = [];

  function ensure(W: number) {
    if (W === cachedW && cols.length === W) return;
    cachedW = W;
    cols = new Array(W).fill(0).map((_, i) => {
      const h = hash(i, seed, 0);
      return {
        active: h < density,
        speed: 0.6 + hash(i, seed + 1, 0) * 1.4,
        offset: hash(i, seed + 2, 0) * 20,
        charIdx: Math.floor(hash(i, seed + 3, 0) * chars.length),
      };
    });
  }

  return (t, x, y, W, H) => {
    ensure(W);
    const col = cols[x];
    if (!col || !col.active) return ' ';
    const head = ((t * speed * col.speed * 8 + col.offset) % (H + trail * 2)) - trail;
    const dist = head - y;
    if (dist < 0 || dist >= trail) return ' ';
    // brightest at the head, fades down the tail
    if (dist < 0.5) return '│';
    return chars[col.charIdx];
  };
}

/* -------------------------------------------------------------------------- */
/*  Sparkles / stars — stage-up bursts, boot banner tails                     */
/* -------------------------------------------------------------------------- */

export interface StarsOptions {
  /** Sparkle density [0..1]. */
  density?: number;
  /** Glyphs sampled at random for each lit cell. */
  glyphs?: string;
  /** Strobe rate — higher = faster re-seeding of sparkles. */
  rate?: number;
}

export function stars(opts: StarsOptions = {}): CellFn {
  const density = opts.density ?? 0.02;
  const glyphs = opts.glyphs ?? '·.·*+✦';
  const rate = opts.rate ?? 3;
  return (t, x, y) => {
    const tick = Math.floor(t * rate);
    const h = hash(x, y, tick);
    if (h >= density) return ' ';
    return glyphs[Math.floor(hash(x, y, tick + 1) * glyphs.length)];
  };
}

/* -------------------------------------------------------------------------- */
/*  Breathing brightness pulse — ambient mascot halo                          */
/* -------------------------------------------------------------------------- */

export interface PulseOptions {
  period?: number;
  ramp?: string;
  amplitude?: number;
}

/** Uniform-field breathing pulse — every cell modulates the same ramp. */
export function pulse(opts: PulseOptions = {}): CellFn {
  const period = opts.period ?? 3.2;
  const ramp = opts.ramp ?? ' ·:•';
  const amp = opts.amplitude ?? 1;
  return (t) => {
    const v = (Math.sin((t / period) * Math.PI * 2) * 0.5 + 0.5) * amp;
    return rampChar(ramp, v);
  };
}

/* -------------------------------------------------------------------------- */
/*  Frame morph — transition between two static ASCII strings                 */
/* -------------------------------------------------------------------------- */

/**
 * Dither-morph from `before` to `after` over `durationSec` seconds.
 * Each cell independently flips once its randomness threshold is
 * crossed, so the transition feels like static dissolving.
 *
 * `before` / `after` must share dimensions — or pass them through
 * `padToGrid(W, H)` before using.
 */
export function morph(
  before: string,
  after: string,
  durationSec: number,
  startAt = 0,
): CellFn {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  return (t, x, y) => {
    const progress = Math.min(1, Math.max(0, (t - startAt) / durationSec));
    const threshold = hash(x, y, 0);
    const pickAfter = progress > threshold;
    const lines = pickAfter ? afterLines : beforeLines;
    return lines[y]?.[x] ?? ' ';
  };
}

/* -------------------------------------------------------------------------- */
/*  Glitch shiver — brief row-shift on error / recovering                     */
/* -------------------------------------------------------------------------- */

export interface ShiverOptions {
  maxShift?: number;
  rate?: number;
}

/**
 * Wraps another CellFn and shifts each row horizontally by a random
 * amount keyed on y + time. Looks like the signal is coming in noisy.
 */
export function shiver(base: CellFn, opts: ShiverOptions = {}): CellFn {
  const maxShift = opts.maxShift ?? 3;
  const rate = opts.rate ?? 8;
  return (t, x, y, W, H) => {
    const tick = Math.floor(t * rate);
    const shift = Math.floor((hash(y, tick, 0) - 0.5) * maxShift * 2);
    const sx = ((x - shift) % W + W) % W;
    return base(t, sx, y, W, H);
  };
}
