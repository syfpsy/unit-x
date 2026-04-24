/**
 * Tiny procedural ASCII animation engine.
 *
 * An animation is a pure function `(t, x, y) -> char`. Time ticks, the
 * grid is re-sampled, the output is stringified and dropped into a
 * `<pre>`. No canvas, no WebGL — just characters.
 *
 * Design invariants:
 *   - Everything is a pure function so primitives compose cleanly.
 *   - Frames are strings, not arrays. The render loop concatenates.
 *   - Time is in seconds (fractional). Absolute, not delta — means
 *     primitives can be expressed as `sin(x * k + t)` without state.
 *   - Reduced-motion = render exactly one frame at t=0 and stop. Callers
 *     use `useAsciiFrame`, which honours the OS setting automatically.
 *
 * Keep this file zero-dep; any React stuff goes in `useAsciiFrame.ts`.
 */

/**
 * A single cell's content at a point in time and space.
 * Return a single character (space for "empty"). Strings longer than
 * one char are truncated by the caller.
 */
export type CellFn = (
  t: number,
  x: number,
  y: number,
  W: number,
  H: number,
) => string;

/** Compute one frame as a newline-joined string of W x H chars. */
export function render(fn: CellFn, W: number, H: number, t: number): string {
  const rows = new Array<string>(H);
  for (let y = 0; y < H; y++) {
    let line = '';
    for (let x = 0; x < W; x++) {
      const c = fn(t, x, y, W, H);
      line += c.length === 1 ? c : c[0] ?? ' ';
    }
    rows[y] = line;
  }
  return rows.join('\n');
}

/**
 * Stack cells top-to-bottom. Earlier args paint on top — the first
 * non-space char wins. Space is treated as transparent.
 *
 *   layer(mascot, rain)   // mascot chars show through rain
 */
export function layer(...fns: CellFn[]): CellFn {
  return (t, x, y, W, H) => {
    for (let i = 0; i < fns.length; i++) {
      const c = fns[i](t, x, y, W, H);
      if (c && c !== ' ') return c;
    }
    return ' ';
  };
}

/** Replace-mode compositor — later fn wins regardless of content. */
export function overwrite(...fns: CellFn[]): CellFn {
  return (t, x, y, W, H) => {
    let c = ' ';
    for (let i = 0; i < fns.length; i++) c = fns[i](t, x, y, W, H);
    return c;
  };
}

/** Convert a static multi-line string into a CellFn — handy for sprites. */
export function sprite(text: string, anchorX = 0, anchorY = 0): CellFn {
  const lines = text.split('\n');
  return (_t, x, y) => {
    const row = y - anchorY;
    if (row < 0 || row >= lines.length) return ' ';
    const col = x - anchorX;
    const line = lines[row];
    if (col < 0 || col >= line.length) return ' ';
    const ch = line[col];
    return ch === ' ' ? ' ' : ch;
  };
}

/** Scale a CellFn's output by gating cells through a dither mask. */
export function mask(fn: CellFn, gate: (x: number, y: number, t: number) => boolean): CellFn {
  return (t, x, y, W, H) => (gate(x, y, t) ? fn(t, x, y, W, H) : ' ');
}

/* -------------------------------------------------------------------------- */
/*  Noise + math helpers                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Deterministic value-noise in [0, 1). Hash of (x, y, t) via the
 * classic "sin-cos-fract" trick. Cheap, good enough for sparkles,
 * star fields, rain, dither. Not for physics.
 */
export function hash(x: number, y: number, t: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + t * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp x to [lo, hi]. */
export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/**
 * Pick a character from a ramp by a [0, 1) parameter. The classic
 * "brightness ramp" ` .:-=+*#%@` progresses from empty → solid.
 */
export function rampChar(ramp: string, value: number): string {
  if (ramp.length === 0) return ' ';
  const v = value < 0 ? 0 : value >= 1 ? 0.999999 : value;
  return ramp[Math.floor(v * ramp.length)];
}
