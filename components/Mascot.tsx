'use client';

import { Fragment, useEffect, useState } from 'react';
import { MASCOT_BY_STAGE } from './mascots/stages';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import type { MascotState } from './types';
import type { EvolutionStage } from '@/lib/evolution';

interface MascotProps {
  state?: MascotState;
  speakingTick?: number;
  /** Evolution stage drives the ASCII template. Defaults to stage 1 (base). */
  stage?: EvolutionStage;
  /**
   * When an equipped mascot cosmetic has a literal template (i.e. not the
   * default "delegate to stage" variant), the gallery pushes it in here
   * and it replaces the stage-based rendering until something else is
   * equipped. `null` means fall back to stage-based.
   */
  templateOverride?: string | null;
}

export function Mascot({
  state = 'idle',
  speakingTick = 0,
  stage = 1,
  templateOverride = null,
}: MascotProps) {
  const [blink, setBlink] = useState(false);
  const [frame, setFrame] = useState(0);
  const reduced = usePrefersReducedMotion();

  // Skip random blinks when the user prefers reduced motion — the
  // `-` eye glyph would still flash every few seconds otherwise.
  useEffect(() => {
    if (reduced) {
      setBlink(false);
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    const cycle = () => {
      const delay = 2200 + Math.random() * 3200;
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 140);
        cycle();
      }, delay);
    };
    cycle();
    return () => clearTimeout(t);
  }, [reduced]);

  // Mouth-frame cycling only runs while the model is speaking AND the
  // user hasn't asked for reduced motion. Static mouth (`─────`) remains
  // rendered in either quieted state — the shape is still legible.
  useEffect(() => {
    if (reduced || state !== 'speaking') {
      setFrame(0);
      return;
    }
    const iv = setInterval(() => setFrame((f) => (f + 1) % 3), 120);
    return () => clearInterval(iv);
  }, [state, speakingTick, reduced]);

  const eyesChar = blink ? '-' : state === 'thinking' ? '◦' : '●';
  const mouthChars = (() => {
    if (state === 'thinking') return reduced ? '·····' : '· · ·';
    if (state !== 'speaking') return '─────';
    // speaking + reduced motion → hold a single frame that reads as "mouth open".
    if (reduced) return '▂▂▂▂▂';
    return (['▁▁▁▁▁', '▂▃▂▃▂', '▁▂▃▂▁'] as const)[frame];
  })();

  const template = templateOverride ?? MASCOT_BY_STAGE[stage] ?? MASCOT_BY_STAGE[1];
  // Substitute the 5-char mouth first so it doesn't collide with the
  // single-char `E` eye marker. `M` appears exactly once per template.
  const withMouth = template.replace(/M/, mouthChars);
  const withEyes = withMouth.split('E').map((seg, i, arr) => (
    <Fragment key={i}>
      {seg}
      {i < arr.length - 1 && <span className="eyes">{eyesChar}</span>}
    </Fragment>
  ));

  const status =
    state === 'speaking'
      ? 'TRANSMITTING'
      : state === 'thinking'
      ? 'PROCESSING'
      : 'STANDBY';

  return (
    <div
      className="mascot"
      role="img"
      aria-label={`UNIT-X · ${status.toLowerCase()}`}
    >
      <div className="breathing">
        <pre style={{ margin: 0 }} aria-hidden="true">
          {withEyes}
        </pre>
      </div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.2em',
          color: 'var(--phosphor-faint)',
          marginTop: 6,
        }}
      >
        {status}
      </div>
    </div>
  );
}
