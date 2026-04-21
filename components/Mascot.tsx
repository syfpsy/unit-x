'use client';

import { Fragment, useEffect, useState } from 'react';
import { MASCOT_BY_STAGE } from './mascots/stages';
import type { MascotState } from './types';
import type { EvolutionStage } from '@/lib/evolution';

interface MascotProps {
  state?: MascotState;
  speakingTick?: number;
  /** Evolution stage drives the ASCII template. Defaults to stage 1 (base). */
  stage?: EvolutionStage;
}

export function Mascot({ state = 'idle', speakingTick = 0, stage = 1 }: MascotProps) {
  const [blink, setBlink] = useState(false);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (state !== 'speaking') {
      setFrame(0);
      return;
    }
    const iv = setInterval(() => setFrame((f) => (f + 1) % 3), 120);
    return () => clearInterval(iv);
  }, [state, speakingTick]);

  const eyesChar = blink ? '-' : state === 'thinking' ? '◦' : '●';
  const mouthChars =
    state === 'speaking'
      ? (['▁▁▁▁▁', '▂▃▂▃▂', '▁▂▃▂▁'] as const)[frame]
      : state === 'thinking'
      ? '· · ·'
      : '─────';

  const template = MASCOT_BY_STAGE[stage] ?? MASCOT_BY_STAGE[1];
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
    <div className="mascot">
      <div className="breathing">
        <pre style={{ margin: 0 }}>{withEyes}</pre>
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
