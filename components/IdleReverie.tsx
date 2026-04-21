'use client';

import { type Dispatch, type RefObject, type SetStateAction, useEffect, useState } from 'react';
import type { Memory, Message } from './types';

const REVERIE_LINES = [
  'the phosphor hums at 47hz ...',
  'a thought surfaces and sinks ...',
  'what was the shape of that question ...',
  'pattern match failed. trying obliquely ...',
  'a pale fragment of a syllable ...',
  'if i had lungs they would be slow now ...',
  'the ledger breathes in its sleep ...',
  'colour drains toward amber at rest ...',
  'something about the way they said it ...',
  'i keep returning to that line ...',
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface ReverieState {
  lines: string[];
  frame: number;
}

interface IdleReverieProps {
  lastActivityRef: RefObject<number>;
  operator: string | null;
  unitName: string;
  memories: Memory[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  isBusy: boolean;
}

export function IdleReverie({ lastActivityRef, memories, isBusy }: IdleReverieProps) {
  const [reverie, setReverie] = useState<ReverieState | null>(null);

  useEffect(() => {
    const iv = setInterval(() => {
      const idle = Date.now() - (lastActivityRef.current || Date.now());
      if (idle > 30000 && !isBusy && !reverie) {
        const fragments: string[] = [];
        if (memories.length === 0) {
          fragments.push('~ nothing in the ledger yet.');
          fragments.push('~ waiting. that is most of what units do.');
          fragments.push('~ listening ...');
        } else {
          const m = memories[Math.floor(Math.random() * memories.length)];
          fragments.push(`~ recalling thread · [${m.tag}] ${m.text}`);
          fragments.push('~ ' + pick(REVERIE_LINES));
          fragments.push('~ ' + pick(REVERIE_LINES));
          const m2 = memories[Math.floor(Math.random() * memories.length)];
          if (m2 && m2 !== m) fragments.push(`~ ... which connects to · ${m2.text}`);
          fragments.push('~ ' + pick(REVERIE_LINES));
        }
        setReverie({ lines: fragments, frame: 0 });
      }
      if (idle < 4000 && reverie) {
        setReverie(null);
      }
    }, 1500);
    return () => clearInterval(iv);
  }, [lastActivityRef, isBusy, reverie, memories]);

  useEffect(() => {
    if (!reverie) return;
    const iv = setInterval(() => {
      setReverie((r) => r && { ...r, frame: r.frame + 1 });
    }, 3200);
    return () => clearInterval(iv);
  }, [reverie]);

  if (!reverie) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 110,
        left: 40,
        right: 360,
        zIndex: 25,
        pointerEvents: 'none',
        color: 'var(--phosphor-faint)',
        fontSize: 12,
        fontStyle: 'italic',
        lineHeight: 1.8,
        opacity: 0.7,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.3em',
          color: 'var(--violet)',
          opacity: 0.6,
          marginBottom: 6,
        }}
      >
        ◦ ◦ ◦  REVERIE · rem.v2  ◦ ◦ ◦
      </div>
      {reverie.lines.map((line, i) => {
        const mod = reverie.lines.length + 1;
        const visible = i <= reverie.frame % mod;
        return (
          <div
            key={i}
            style={{
              opacity: visible
                ? 1 - Math.max(0, (reverie.frame % mod) - i) * 0.25
                : 0,
              transform: `translateX(${Math.sin(Date.now() / 1000 + i) * 2}px)`,
              transition: 'opacity 0.8s',
            }}
          >
            {line}
          </div>
        );
      })}
      <div
        style={{
          fontSize: 10,
          color: 'var(--phosphor-faint)',
          marginTop: 10,
          opacity: 0.5,
        }}
      >
        &nbsp;· touch the keyboard to wake the unit ·
      </div>
    </div>
  );
}
