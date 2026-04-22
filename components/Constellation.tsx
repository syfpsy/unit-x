'use client';

import { useMemo, useState } from 'react';
import type { Memory, MemoryTag } from './types';

interface ConstellationProps {
  memories: Memory[];
  onClose: () => void;
}

const W = 72;
const H = 22;

const TAG_GLYPH: Record<MemoryTag, string> = {
  fact: '*',
  rel: '\u25c6',
  thread: '+',
  feeling: '\u00b7',
  world: '\u25cb',
};

const TAG_LABEL: Record<MemoryTag, string> = {
  fact: 'fact',
  rel: 'relation',
  thread: 'thread',
  feeling: 'feeling',
  world: 'world',
};

// FNV-1a 32-bit. Stable across runs so the same ledger always draws the
// same sky — consistent with the "something is remembering you" premise.
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'they', 'them', 'their',
  'have', 'been', 'would', 'could', 'should', 'about', 'there', 'when', 'what',
  'where', 'which', 'while', 'some', 'your', 'you', 'its', 'into', 'over', 'also',
  'more', 'than', 'then', 'just', 'like', 'only', 'even', 'ever', 'very', 'much',
  'not', 'any', 'all', 'but', 'are', 'was', 'were', 'will', 'has', 'had', 'can',
  'our', 'ours', 'his', 'hers', 'her', 'him', 'she', 'who', 'how', 'why', 'does',
  'did', 'off', 'out', 'onto', 'upon', 'because', 'between', 'after', 'before',
  'again', 'back', 'said', 'say', 'one', 'two', 'three', 'thing', 'things',
  'something', 'someone', 'anything', 'everyone', 'nobody', 'anybody',
]);

function tokens(s: string): string[] {
  return Array.from(
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4 && !STOP.has(w)),
    ),
  );
}

interface StarPos {
  id: string;
  tag: MemoryTag;
  x: number;
  y: number;
  recency: number; // 0..1 where 1 = newest
  tokens: string[];
}

function placeStars(memories: Memory[]): StarPos[] {
  if (memories.length === 0) return [];
  const times = memories.map((m) => m.ts);
  const maxT = Math.max(...times);
  const minT = Math.min(...times);
  const range = Math.max(1, maxT - minT);

  const occupied = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;

  const stars: StarPos[] = [];
  for (const m of memories) {
    const seed = String(m.id);
    const h1 = hashStr(seed + ':x');
    const h2 = hashStr(seed + ':y');
    let x = 2 + (h1 % (W - 4));
    let y = 1 + (h2 % (H - 2));
    let tries = 0;
    while (occupied.has(key(x, y)) && tries < 256) {
      x += 1;
      if (x >= W - 2) {
        x = 2;
        y += 1;
        if (y >= H - 1) y = 1;
      }
      tries++;
    }
    occupied.add(key(x, y));
    stars.push({
      id: seed,
      tag: m.tag,
      x,
      y,
      recency: (m.ts - minT) / range,
      tokens: tokens(m.text),
    });
  }
  return stars;
}

interface Edge {
  a: number;
  b: number;
  weight: number;
}

function buildEdges(stars: StarPos[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      const a = stars[i];
      const b = stars[j];
      let shared = 0;
      for (const t of a.tokens) if (b.tokens.includes(t)) shared++;
      if (shared > 0) edges.push({ a: i, b: j, weight: shared });
    }
  }
  edges.sort((x, y) => y.weight - x.weight);
  const cap = Math.min(edges.length, Math.max(4, stars.length * 2));
  return edges.slice(0, cap);
}

interface Cell {
  ch: string;
  star?: boolean;
  edge?: boolean;
  focus?: boolean;
  recency?: number;
}

function pickEdgeGlyph(dx: number, dy: number): string {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (ady * 2 < adx) return '\u2500'; // ─
  if (adx * 2 < ady) return '\u2502'; // │
  if ((dx > 0) === (dy > 0)) return '\u2572'; // ╲
  return '\u2571'; // ╱
}

function drawLine(
  grid: Cell[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  focus: boolean,
) {
  // Bresenham's line — skip endpoints (stars) and don't overwrite stars.
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  const glyph = pickEdgeGlyph(x1 - x0, y1 - y0);

  for (;;) {
    const isEndpoint = (x === x0 && y === y0) || (x === x1 && y === y1);
    if (!isEndpoint) {
      const cell = grid[y]?.[x];
      if (cell && !cell.star) {
        if (!cell.edge || focus) {
          cell.ch = glyph;
          cell.edge = true;
          if (focus) cell.focus = true;
        }
      }
    }
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

export function Constellation({ memories, onClose }: ConstellationProps) {
  const [focusIdx, setFocusIdx] = useState<number | null>(null);

  const { stars, edges, grid } = useMemo(() => {
    const s = placeStars(memories);
    const e = buildEdges(s);
    const g: Cell[][] = Array.from({ length: H }, () =>
      Array.from({ length: W }, () => ({ ch: ' ' })),
    );
    // Edges first so stars overwrite intersections cleanly.
    for (const edge of e) {
      const a = s[edge.a];
      const b = s[edge.b];
      const focus = focusIdx === edge.a || focusIdx === edge.b;
      drawLine(g, a.x, a.y, b.x, b.y, focus);
    }
    s.forEach((st, i) => {
      const cell = g[st.y][st.x];
      cell.ch = TAG_GLYPH[st.tag];
      cell.star = true;
      cell.recency = st.recency;
      if (focusIdx === i) cell.focus = true;
    });
    return { stars: s, edges: e, grid: g };
  }, [memories, focusIdx]);

  const counts: Record<MemoryTag, number> = {
    fact: 0,
    rel: 0,
    thread: 0,
    feeling: 0,
    world: 0,
  };
  for (const m of memories) counts[m.tag]++;

  return (
    <div
      className="soul-doc"
      role="dialog"
      aria-modal="true"
      aria-label="constellation"
    >
      <div className="panel-head">
        <span className="lead">/ constellation</span>
        <span className="meta">
          {stars.length} star(s) · {edges.length} link(s)
        </span>
        <button className="term-btn" style={{ marginLeft: 12 }} onClick={onClose}>
          [esc] close
        </button>
      </div>
      <div className="panel-body">
        <pre
          style={{
            color: 'var(--violet)',
            textShadow: '0 0 8px var(--violet-glow)',
            margin: 0,
            fontSize: 11,
            lineHeight: 1.15,
          }}
        >
{`   \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
   \u2551                                                              \u2551
   \u2551        \u25c6  C O N S T E L L A T I O N  \u25c6                       \u2551
   \u2551        \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500                       \u2551
   \u2551        the ledger plotted as a sky \u00b7 links are shared words  \u2551
   \u2551                                                              \u2551
   \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d`}
        </pre>

        <div style={{ height: 14 }} />

        {stars.length === 0 ? (
          <div
            style={{
              color: 'var(--phosphor-faint)',
              fontStyle: 'italic',
              fontSize: 12,
            }}
          >
            &gt; the sky is empty. speak to the unit until it has something to
            remember.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 280px',
              gap: 20,
              alignItems: 'start',
            }}
          >
            <pre
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: 1.15,
                overflowX: 'auto',
                padding: 10,
                border: '1px dashed var(--phosphor-faint)',
                background: 'rgba(0,0,0,0.35)',
              }}
              aria-hidden
            >
              {grid.map((row, y) => (
                <div key={y}>
                  {row.map((cell, x) => {
                    let color = 'transparent';
                    let textShadow = 'none';
                    if (cell.focus) {
                      color = 'var(--violet)';
                      textShadow = '0 0 6px var(--violet-glow)';
                    } else if (cell.star) {
                      const r = cell.recency ?? 0;
                      color =
                        r > 0.66
                          ? 'var(--phosphor)'
                          : r > 0.33
                          ? 'var(--phosphor-dim)'
                          : 'var(--phosphor-faint)';
                      if (r > 0.66) textShadow = '0 0 4px var(--phosphor-dim)';
                    } else if (cell.edge) {
                      color = 'var(--phosphor-faint)';
                    }
                    return (
                      <span
                        key={`${x}-${y}`}
                        style={{ color, textShadow }}
                      >
                        {cell.ch}
                      </span>
                    );
                  })}
                </div>
              ))}
            </pre>

            <div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--phosphor-faint)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                legend
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--phosphor-dim)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {(Object.keys(TAG_GLYPH) as MemoryTag[]).map((t) => (
                  <div key={t} style={{ display: 'flex', gap: 8 }}>
                    <span
                      style={{
                        color: 'var(--phosphor)',
                        width: 12,
                        textAlign: 'center',
                      }}
                    >
                      {TAG_GLYPH[t]}
                    </span>
                    <span style={{ width: 70 }}>{TAG_LABEL[t]}</span>
                    <span style={{ color: 'var(--phosphor-faint)' }}>
                      · {counts[t]}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ height: 14 }} />

              <div
                style={{
                  fontSize: 10,
                  color: 'var(--phosphor-faint)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                stars
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  maxHeight: 320,
                  overflow: 'auto',
                }}
              >
                {stars.map((s, i) => {
                  const mem = memories[i];
                  const isFocus = focusIdx === i;
                  return (
                    <button
                      type="button"
                      key={`${s.id}-${i}`}
                      onMouseEnter={() => setFocusIdx(i)}
                      onMouseLeave={() =>
                        setFocusIdx((v) => (v === i ? null : v))
                      }
                      onFocus={() => setFocusIdx(i)}
                      onBlur={() =>
                        setFocusIdx((v) => (v === i ? null : v))
                      }
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: '2px 4px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: isFocus ? 'var(--violet)' : 'var(--phosphor)',
                        textShadow: isFocus
                          ? '0 0 6px var(--violet-glow)'
                          : 'none',
                        fontSize: 11,
                        fontFamily: 'inherit',
                        display: 'flex',
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          color: isFocus
                            ? 'var(--violet)'
                            : 'var(--phosphor-faint)',
                          width: 12,
                        }}
                      >
                        {TAG_GLYPH[s.tag]}
                      </span>
                      <span style={{ flex: 1 }}>{mem.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <pre
          style={{
            color: 'var(--phosphor-faint)',
            fontSize: 10,
            marginTop: 24,
          }}
        >
{`   // links appear where two memories share a keyword.
   // the same operator, the same memories, will always draw the same sky.`}
        </pre>
      </div>
    </div>
  );
}
