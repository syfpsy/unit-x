'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { mergeSpecs, renderPortrait } from '@/lib/portrait/render';
import { STAGE_SPECS } from '@/lib/portrait/stages';
import type { CosmeticPayload } from '@/lib/cosmetics/types';
import type { EvolutionStage } from '@/lib/evolution';
import type { MascotState } from './types';

interface MascotProps {
  state?: MascotState;
  speakingTick?: number;
  /** Evolution stage drives the default slot assignment. Defaults to 1. */
  stage?: EvolutionStage;
  /** Equipped mascot cosmetic's payload. Supports three shapes:
   *    - `{ delegate: 'stage' | 'default' }` → render stage default unchanged
   *    - `{ template: '…' }`                  → render literal (legacy path)
   *    - `{ slotOverrides: { slots: {…} } }`  → overlay on top of stage default
   *  null means no cosmetic equipped — same as `delegate: 'stage'`. */
  cosmeticPayload?: CosmeticPayload | null;
}

export function Mascot({
  state = 'idle',
  speakingTick = 0,
  stage = 1,
  cosmeticPayload = null,
}: MascotProps) {
  const [blink, setBlink] = useState(false);
  const [frame, setFrame] = useState(0);
  const reduced = usePrefersReducedMotion();

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
    if (reduced) return '▂▂▂▂▂';
    return (['▁▁▁▁▁', '▂▃▂▃▂', '▁▂▃▂▁'] as const)[frame];
  })();

  // Resolve the mascot template. Memoised so changing only eye/mouth
  // state doesn't re-run the slot merger. Recomputed when stage or the
  // equipped cosmetic changes.
  const template = useMemo(() => {
    if (cosmeticPayload?.template) return cosmeticPayload.template;
    const base = STAGE_SPECS[stage] ?? STAGE_SPECS[1];
    const overlay = cosmeticPayload?.slotOverrides;
    const spec = overlay ? mergeSpecs(base, overlay) : base;
    return renderPortrait(spec);
  }, [stage, cosmeticPayload]);

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
