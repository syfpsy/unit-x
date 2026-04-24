'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { type CellFn, render } from './engine';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

export interface UseAsciiFrameOptions {
  width: number;
  height: number;
  /** Frames per second. 10–15 is the terminal sweet spot. */
  fps?: number;
  /**
   * Optional steady-state frame for reduced-motion users. Defaults to
   * whatever `cell` renders at t=0. Override when t=0 looks empty.
   */
  reducedMotionFrame?: string;
  /** Start paused — flip to `true` to run. Good for "only while X state". */
  running?: boolean;
}

/**
 * React hook: drives a CellFn at a fixed FPS and returns the current
 * frame as a string. Drop into `<pre>{frame}</pre>` and you're done.
 *
 * - Respects `prefers-reduced-motion`: a single static frame, no RAF.
 * - Cleans up the RAF loop on unmount / when `running` flips off.
 * - Time starts at mount; `cell` is called with absolute seconds so
 *   primitives written with `sin(t)` work unchanged.
 *
 * Implementation note: the static (t=0) frame is derived synchronously
 * via `useMemo` so reduced-motion + paused users never need a setState
 * pass — the effect only runs for the animated branch.
 */
export function useAsciiFrame(
  cell: CellFn,
  opts: UseAsciiFrameOptions,
): string {
  const { width, height, fps = 12, reducedMotionFrame, running = true } = opts;
  const reduced = usePrefersReducedMotion();

  // The caller's cell fn is almost always produced inline (`scan(...)`)
  // so its identity changes on every render. We ref it so the animation
  // loop doesn't tear down + recreate on parent re-renders. The loop
  // always reads the latest cell fn through the ref.
  const cellRef = useRef(cell);
  useEffect(() => {
    cellRef.current = cell;
  }, [cell]);

  const staticFrame = useMemo(
    () => reducedMotionFrame ?? render(cell, width, height, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height, reducedMotionFrame],
  );
  const [liveFrame, setLiveFrame] = useState(staticFrame);

  useEffect(() => {
    if (!running || reduced) return;
    const interval = 1000 / fps;
    const start = performance.now();
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      if (now - last >= interval) {
        setLiveFrame(render(cellRef.current, width, height, (now - start) / 1000));
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [width, height, fps, reduced, running]);

  return reduced || !running ? staticFrame : liveFrame;
}
