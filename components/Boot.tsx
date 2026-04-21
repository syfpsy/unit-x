'use client';

import { useEffect, useRef, useState } from 'react';

type BootLine = { t: 'dim' | 'faint' | 'ok' | 'violet' | 'warn'; s: string };

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
}

export function Boot({ onComplete, speed = 1 }: BootProps) {
  const [shown, setShown] = useState(0);
  const [subChar, setSubChar] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    if (shown >= BOOT_LINES.length) {
      doneRef.current = true;
      const t = setTimeout(onComplete, 600);
      return () => clearTimeout(t);
    }
    const line = BOOT_LINES[shown];
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

  return (
    <div className="boot">
      {BOOT_LINES.slice(0, shown).map((l, i) => (
        <pre key={i} className={l.t}>
          {l.s || ' '}
        </pre>
      ))}
      {shown < BOOT_LINES.length && (
        <pre className={BOOT_LINES[shown].t}>
          {BOOT_LINES[shown].s.slice(0, subChar)}
          <span style={{ background: 'var(--phosphor)', color: '#000', padding: '0 3px' }}>_</span>
        </pre>
      )}
    </div>
  );
}
