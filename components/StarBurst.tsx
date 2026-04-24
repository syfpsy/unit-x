'use client';

import { useEffect, useState } from 'react';
import { stars } from '@/lib/ascii/primitives';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { AsciiField } from './AsciiField';

interface StarBurstProps {
  /** Increment to re-fire. Initial value (0) means "not yet triggered". */
  trigger: number;
  /** How many seconds the overlay stays visible. */
  durationMs?: number;
  /** Density ramps up then down; peak is at the midpoint. */
  peakDensity?: number;
}

/**
 * Full-viewport ASCII sparkle overlay. Used for rare "celebration"
 * beats — stage-up, cosmetic unlock, soul save. Companion to the
 * existing canvas-based `ParticleBurst`; this one sits in the
 * character grid and reads as terminal-native.
 *
 * Skipped entirely when prefers-reduced-motion is set.
 */
export function StarBurst({
  trigger,
  durationMs = 1800,
  peakDensity = 0.04,
}: StarBurstProps) {
  const [active, setActive] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 80, h: 24 });
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (!trigger) return;
    // Size the grid to fill the viewport in character-cells. The font
    // is monospace ~8x16 at the default UI size, so this is roughly
    // one cell per 10x18 px. We refresh on resize too.
    const resize = () => {
      const charW = 9;
      const charH = 18;
      setDims({
        w: Math.max(20, Math.floor(window.innerWidth / charW)),
        h: Math.max(10, Math.floor(window.innerHeight / charH)),
      });
    };
    resize();
    window.addEventListener('resize', resize);
    setActive(true);
    const t = setTimeout(() => setActive(false), durationMs);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', resize);
    };
  }, [trigger, durationMs, reduced]);

  if (reduced || !active) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 85,
        color: 'var(--violet)',
        textShadow: '0 0 8px var(--violet-glow)',
        mixBlendMode: 'screen',
      }}
      aria-hidden="true"
    >
      <AsciiField
        cell={stars({ density: peakDensity, glyphs: '·✦+*◆·', rate: 4 })}
        width={dims.w}
        height={dims.h}
        fps={14}
        style={{
          fontSize: 14,
          lineHeight: '18px',
          opacity: 0.9,
        }}
      />
    </div>
  );
}
