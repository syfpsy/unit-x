'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

type BurstVariant = 'save' | 'glitch';

interface ParticleBurstProps {
  trigger: number;
  variant: BurstVariant;
}

export function ParticleBurst({ trigger, variant }: ParticleBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (!trigger) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    };
    resize();

    const glyphs =
      variant === 'save'
        ? ['◆', '◇', '▓', '▒', '░', '│', '─', '╱', '╲', '·', '+', '*']
        : ['!', '?', '▓', '█', '░', '╳', '╱', '╲', '#', '@', '░', '▒'];
    const count = variant === 'save' ? 90 : 140;

    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      g: string;
      hue: 'violet' | 'phosphor' | 'hostile';
    };

    const parts: Particle[] = Array.from({ length: count }, () => ({
      x: Math.random() * c.width,
      y: variant === 'save' ? c.height / 2 : -20,
      vx: (Math.random() - 0.5) * (variant === 'save' ? 8 : 2),
      vy: variant === 'save' ? -Math.random() * 9 - 2 : Math.random() * 6 + 2,
      life: 60 + Math.random() * 30,
      g: glyphs[Math.floor(Math.random() * glyphs.length)],
      hue:
        variant === 'glitch' ? (Math.random() < 0.5 ? 'hostile' : 'phosphor') : 'violet',
    }));

    let raf = 0;
    function tick() {
      if (!ctx) return;
      ctx.clearRect(0, 0, c!.width, c!.height);
      let alive = 0;
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += variant === 'save' ? 0.28 : 0.12;
        p.life -= 1;
        if (p.life > 0) {
          alive++;
          const alpha = Math.min(1, p.life / 40);
          ctx.globalAlpha = alpha;
          const ph = getComputedStyle(document.documentElement);
          const phR = ph.getPropertyValue('--ph-r').trim() || '120';
          const phG = ph.getPropertyValue('--ph-g').trim() || '255';
          const phB = ph.getPropertyValue('--ph-b').trim() || '180';
          let color: string;
          if (p.hue === 'violet') color = `rgb(180,150,255)`;
          else if (p.hue === 'hostile') color = `rgb(208,87,87)`;
          else color = `rgb(${phR},${phG},${phB})`;
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
          ctx.font = '14px "JetBrains Mono", monospace';
          ctx.fillText(p.g, p.x, p.y);
        }
      }
      if (alive > 0) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, c!.width, c!.height);
    }
    tick();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [trigger, variant, reduced]);

  if (reduced) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 90,
      }}
    />
  );
}

interface GlitchOverlayProps {
  trigger: number;
}

export function GlitchOverlay({ trigger }: GlitchOverlayProps) {
  const [on, setOn] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (!trigger) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), 650);
    return () => clearTimeout(t);
  }, [trigger, reduced]);

  if (reduced || !on) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 80,
        mixBlendMode: 'screen',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-linear-gradient(to bottom, rgba(208,87,87,0.18) 0px, rgba(208,87,87,0.18) 3px, transparent 3px, transparent 6px)',
          animation: 'glitchA 0.65s steps(8) 1',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 10px, rgba(109,94,247,0.22) 10px, rgba(109,94,247,0.22) 12px)',
          animation: 'glitchB 0.65s steps(6) 1',
        }}
      />
      <style>{`
        @keyframes glitchA {
          0% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-2px); }
          100% { transform: translateX(0); opacity: 0; }
        }
        @keyframes glitchB {
          0% { transform: translateX(0) skewY(0); }
          30% { transform: translateX(8px) skewY(1deg); }
          60% { transform: translateX(-4px) skewY(-0.5deg); }
          100% { transform: translateX(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
