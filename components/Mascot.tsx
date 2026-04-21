'use client';

import { Fragment, useEffect, useState } from 'react';
import type { MascotState } from './types';

interface MascotProps {
  state?: MascotState;
  speakingTick?: number;
}

export function Mascot({ state = 'idle', speakingTick = 0 }: MascotProps) {
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

  const face = `    ╭─────────────╮
   ╱               ╲
  ╱   ┌─┐     ┌─┐   ╲
 │    │E│     │E│    │
 │    └─┘     └─┘    │
  ╲                 ╱
   │    ${mouthChars}    │
   │   ╲_______╱    │
    ╲_____________╱
        │ │││ │
       ═╧═╧╧═╧═`;

  const withEyes = face.split('E').map((seg, i, arr) => (
    <Fragment key={i}>
      {seg}
      {i < arr.length - 1 && <span className="eyes">{eyesChar}</span>}
    </Fragment>
  ));

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
        {state === 'speaking' ? 'TRANSMITTING' : state === 'thinking' ? 'PROCESSING' : 'STANDBY'}
      </div>
    </div>
  );
}
