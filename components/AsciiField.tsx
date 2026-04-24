'use client';

import { type CSSProperties, useMemo } from 'react';
import { type CellFn } from '@/lib/ascii/engine';
import { useAsciiFrame } from '@/lib/ascii/useAsciiFrame';

interface AsciiFieldProps {
  cell: CellFn;
  width: number;
  height: number;
  fps?: number;
  running?: boolean;
  /** Additional class on the `<pre>`. */
  className?: string;
  style?: CSSProperties;
  /** Optional label announced to AT; the visual is hidden by default. */
  ariaLabel?: string;
}

/**
 * Render a CellFn as a live animated `<pre>` block. Monospace, pinned
 * line-height so rows don't drift, and marked aria-hidden by default
 * because the animation is atmospheric, not content.
 */
export function AsciiField({
  cell,
  width,
  height,
  fps = 12,
  running = true,
  className,
  style,
  ariaLabel,
}: AsciiFieldProps) {
  const frame = useAsciiFrame(cell, { width, height, fps, running });
  const mergedStyle = useMemo<CSSProperties>(
    () => ({
      margin: 0,
      lineHeight: 1,
      fontFamily: '"JetBrains Mono", "Fira Mono", ui-monospace, monospace',
      letterSpacing: 0,
      whiteSpace: 'pre',
      ...style,
    }),
    [style],
  );
  return (
    <pre
      className={className}
      style={mergedStyle}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
    >
      {frame}
    </pre>
  );
}
