'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks the `prefers-reduced-motion: reduce` OS setting live.
 * The CSS media query handles most of the suppression; this hook is for the
 * JS-driven FX (ParticleBurst, GlitchOverlay) that can't be killed from CSS.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return reduced;
}
