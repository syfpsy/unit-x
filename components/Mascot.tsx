'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { mergeSpecs, renderPortrait } from '@/lib/portrait/render';
import { STAGE_SPECS } from '@/lib/portrait/stages';
import { pulse, rain, ring, stars } from '@/lib/ascii/primitives';
import { AsciiField } from './AsciiField';
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
  /** Monotonically-increasing key that remounts the tap ring and
   *  re-fires its TTL. Only counts up; the AsciiField resets its
   *  internal clock on each new key. */
  const [rippleKey, setRippleKey] = useState(0);
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
    // Frame cycling applies to speaking + dreaming. Both use the same
    // tick but with different glyph vocabularies (see mouthChars below).
    const animating = state === 'speaking' || state === 'dreaming';
    if (reduced || !animating) {
      setFrame(0);
      return;
    }
    // Dreaming is slower + drifting; speaking is crisper.
    const interval = state === 'dreaming' ? 260 : 120;
    const iv = setInterval(() => setFrame((f) => (f + 1) % 3), interval);
    return () => clearInterval(iv);
  }, [state, speakingTick, reduced]);

  const eyesChar = (() => {
    if (blink) return '-';
    switch (state) {
      case 'thinking':   return '◦';
      case 'dreaming':   return '⊖'; // half-closed — the unit is elsewhere
      case 'recovering': return '╳'; // post-glitch; eyes briefly broken
      case 'speaking':
      case 'idle':
      default:           return '●';
    }
  })();

  const mouthChars = (() => {
    switch (state) {
      case 'thinking':
        return reduced ? '·····' : '· · ·';
      case 'dreaming':
        if (reduced) return '~~~~~';
        return (['∼∽∼∽∼', '∽∼∽∼∽', '∼∽∼∽∼'] as const)[frame];
      case 'recovering':
        return '╌╌╌╌╌'; // dashed — signal intermittent
      case 'speaking':
        if (reduced) return '▂▂▂▂▂';
        return (['▁▁▁▁▁', '▂▃▂▃▂', '▁▂▃▂▁'] as const)[frame];
      case 'idle':
      default:
        return '─────';
    }
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

  // Procedural backdrop sized generously enough to cover the portrait
  // at any stage (stage-4 is tallest, ~11 rows × ~24 cols). Lives in an
  // absolutely-positioned layer beneath the mascot so characters from
  // the mascot paint cleanly on top.
  const BG_W = 30;
  const BG_H = 12;
  const isDreaming = state === 'dreaming';
  const isRecovering = state === 'recovering';
  const isIdle = state === 'idle';

  return (
    <div
      className="mascot"
      role="img"
      aria-label={`UNIT-X · ${status.toLowerCase()}`}
    >
      <div
        style={{
          position: 'relative',
          display: 'inline-block',
          cursor: 'pointer',
        }}
        onClick={() => setRippleKey((k) => k + 1)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setRippleKey((k) => k + 1);
          }
        }}
        tabIndex={0}
        role="button"
        aria-label="ping the unit"
        title="tap to ping"
      >
        {/* Tap ripple — remounts on every click via `key`, so the
             AsciiField internal clock resets and the ring fires fresh.
             ttl matches the primitive default (1.2s). Skip when
             reduced-motion: the single static frame looks like a
             stuck ring. */}
        {rippleKey > 0 && !reduced && (
          <AsciiField
            key={rippleKey}
            cell={ring({ speed: 14, thickness: 1.3, ttl: 1.1 })}
            width={BG_W}
            height={BG_H}
            fps={18}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'var(--violet)',
              opacity: 0.85,
              pointerEvents: 'none',
              zIndex: 3,
              fontSize: 'inherit',
              textShadow: '0 0 6px var(--violet-glow)',
            }}
          />
        )}
        {/* Dreaming: slow rain behind the mascot. */}
        {isDreaming && (
          <AsciiField
            cell={rain({ density: 0.4, speed: 0.35, trail: 5 })}
            width={BG_W}
            height={BG_H}
            fps={10}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'var(--phosphor-faint)',
              opacity: 0.45,
              pointerEvents: 'none',
              zIndex: 0,
              fontSize: 'inherit',
            }}
          />
        )}
        {/* Recovering: static-like sparkles burst across the portrait
             for the 2.4s the state lasts. Higher strobe rate sells the
             "signal dropping" read. */}
        {isRecovering && (
          <AsciiField
            cell={stars({ density: 0.12, glyphs: '·.╱╲╳', rate: 6 })}
            width={BG_W}
            height={BG_H}
            fps={12}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'var(--hostile)',
              opacity: 0.6,
              pointerEvents: 'none',
              zIndex: 2,
              fontSize: 'inherit',
            }}
          />
        )}
        {/* Idle: ambient violet pulse halo that breathes in sync with
             the CSS `.breathing` scale animation. Subtle — aria-hidden
             decorative glow. */}
        {isIdle && !reduced && (
          <AsciiField
            cell={pulse({ period: 3.6, ramp: ' ·•', amplitude: 0.7 })}
            width={BG_W}
            height={BG_H}
            fps={8}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'var(--violet)',
              opacity: 0.18,
              pointerEvents: 'none',
              zIndex: 0,
              fontSize: 'inherit',
            }}
          />
        )}
        <div className="breathing" style={{ position: 'relative', zIndex: 1 }}>
          <pre style={{ margin: 0 }} aria-hidden="true">
            {withEyes}
          </pre>
        </div>
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
