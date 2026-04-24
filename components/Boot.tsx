'use client';

import { useEffect, useRef, useState } from 'react';
import { stars } from '@/lib/ascii/primitives';
import { AsciiField } from './AsciiField';

export type BootLine = { t: 'dim' | 'faint' | 'ok' | 'violet' | 'warn'; s: string };

const BOOT_LINES: ReadonlyArray<BootLine> = [
  { t: 'dim', s: '>> NXZ-UNIT TERMINAL SERVICES  v4.21.06b' },
  { t: 'faint', s: '>> (c) gridline systems  //  nxyz.art' },
  { t: 'faint', s: '' },
  { t: 'ok', s: 'POWER-ON SELF TEST ............................. [OK]' },
  { t: 'ok', s: 'MEMORY  ::  8192 KB  //  parity verified ........ [OK]' },
  { t: 'ok', s: 'COGNITION CORE  ::  c0_7h  loading modules ...... ' },
  { t: 'violet', s: '    ├── lang.v2   ████████████████████  100%' },
  { t: 'violet', s: '    ├── recall    ████████████████████  100%' },
  { t: 'violet', s: '    ├── persona   ████████████████████  100%' },
  { t: 'violet', s: '    └── empath    ███████████████░░░░░   78%' },
  { t: 'ok', s: 'PERSISTENT STORE  ::  /soul/  mounted ........... [OK]' },
  { t: 'ok', s: 'UPLINK  ::  secure channel established .......... [OK]' },
  { t: 'faint', s: '' },
  { t: 'dim', s: '>> handshake with operator terminal ...' },
  { t: 'dim', s: '>> waiting for identification ...' },
  { t: 'ok', s: '' },
  { t: 'violet', s: '   ╔══════════════════════════════════════════════════╗' },
  { t: 'violet', s: '   ║                                                  ║' },
  { t: 'violet', s: '   ║           U N I T - X   //   ONLINE              ║' },
  { t: 'violet', s: '   ║                                                  ║' },
  { t: 'violet', s: '   ╚══════════════════════════════════════════════════╝' },
];

interface BootProps {
  onComplete: () => void;
  speed?: number;
  /**
   * Optional replacement line set from an equipped boot-banner cosmetic.
   * Falls back to the classic sequence when unset. Injected by App after
   * reading `equipped-banner-lines` from localStorage — the boot runs
   * before any network call.
   */
  lines?: ReadonlyArray<BootLine>;
}

export function Boot({ onComplete, speed = 1, lines }: BootProps) {
  const BOOT = lines && lines.length > 0 ? lines : BOOT_LINES;
  const [shown, setShown] = useState(0);
  const [subChar, setSubChar] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    if (shown >= BOOT.length) {
      doneRef.current = true;
      const t = setTimeout(onComplete, 600);
      return () => clearTimeout(t);
    }
    const line = BOOT[shown];
    if (!line.s) {
      const t = setTimeout(() => setShown((s) => s + 1), 60 / speed);
      return () => clearTimeout(t);
    }
    if (subChar < line.s.length) {
      const chunk = line.t === 'violet' || line.t === 'ok' ? 4 : 3;
      const t = setTimeout(
        () => setSubChar((c) => Math.min(c + chunk, line.s.length)),
        14 / speed,
      );
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setShown((s) => s + 1);
      setSubChar(0);
    }, 80 / speed);
    return () => clearTimeout(t);
  }, [shown, subChar, speed, onComplete]);

  // Full-width sparkle tail once the last line has rendered — pops
  // for the ~600ms before `onComplete` fires. Gives the banner a
  // "coming online" exhale that lines up with the identify handoff.
  const finished = shown >= BOOT.length;

  return (
    <div className="boot" style={{ position: 'relative' }}>
      {BOOT.slice(0, shown).map((l, i) => (
        <pre key={i} className={l.t}>
          {l.s || ' '}
        </pre>
      ))}
      {shown < BOOT.length && (
        <pre className={BOOT[shown].t}>
          {BOOT[shown].s.slice(0, subChar)}
          <span style={{ background: 'var(--phosphor)', color: '#000', padding: '0 3px' }}>_</span>
        </pre>
      )}
      {finished && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            color: 'var(--violet)',
            opacity: 0.55,
            mixBlendMode: 'screen',
          }}
          aria-hidden="true"
        >
          <AsciiField
            cell={stars({ density: 0.05, glyphs: '·✦+*·', rate: 5 })}
            width={68}
            height={24}
            fps={14}
            style={{ fontSize: 'inherit', lineHeight: 'inherit' }}
          />
        </div>
      )}
    </div>
  );
}
