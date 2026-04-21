'use client';

import { useEffect, useState } from 'react';

interface TimelineEntry {
  kind: 'bound' | 'stage-up' | 'cosmetic';
  at: number;
  title: string;
  blurb: string;
  accent?: 'violet' | 'phosphor';
  meta?: Record<string, string | number>;
}

interface TimelineProps {
  onClose: () => void;
}

function fmt(ts: number): string {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} · ${hh}:${mm}`;
}

function daysAgo(ts: number): string {
  const ms = Date.now() - ts;
  const day = Math.floor(ms / 86_400_000);
  if (day <= 0) return 'today';
  if (day === 1) return 'yesterday';
  if (day < 30) return `${day}d ago`;
  if (day < 365) return `${Math.floor(day / 30)}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}

const KIND_GLYPH: Record<TimelineEntry['kind'], string> = {
  bound: '◆',
  'stage-up': '▲',
  cosmetic: '·',
};

export function Timeline({ onClose }: TimelineProps) {
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/timeline');
        const body = (await res.json()) as { entries?: TimelineEntry[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setErr(body.error ?? 'could not load timeline');
          return;
        }
        setEntries(body.entries ?? []);
      } catch (e) {
        if (!cancelled) setErr(String((e as Error).message || e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="soul-doc"
      role="dialog"
      aria-modal="true"
      aria-label="operator timeline"
    >
      <div className="panel-head">
        <span className="lead">/ timeline</span>
        <span className="meta">
          {entries ? `${entries.length} entrie(s)` : '…'}
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
{`   ╔══════════════════════════════════════════════════════════════╗
   ║                                                              ║
   ║        ◆  T I M E L I N E  ◆                                 ║
   ║        ───────────────────                                   ║
   ║        the record of what the unit has kept with you.        ║
   ║                                                              ║
   ╚══════════════════════════════════════════════════════════════╝`}
        </pre>

        <div style={{ height: 14 }} />

        {err && (
          <div style={{ color: 'var(--hostile)', fontSize: 12, marginBottom: 10 }}>
            &gt; {err}
          </div>
        )}
        {!entries && !err && (
          <div
            style={{
              color: 'var(--phosphor-faint)',
              fontStyle: 'italic',
              fontSize: 12,
            }}
          >
            &gt; retrieving artifacts …
          </div>
        )}
        {entries && entries.length === 0 && (
          <div style={{ color: 'var(--phosphor-faint)', fontSize: 12 }}>
            &gt; the record is empty. bind an operator to begin.
          </div>
        )}

        {entries &&
          entries.map((e, i) => {
            const violet = e.accent === 'violet';
            return (
              <div
                key={`${e.at}-${i}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '18px 150px 1fr',
                  gap: 12,
                  padding: '8px 0',
                  borderBottom: '1px dashed var(--border-faint)',
                  alignItems: 'baseline',
                }}
              >
                <span
                  style={{
                    color: violet ? 'var(--violet)' : 'var(--phosphor-faint)',
                    textShadow: violet ? '0 0 6px var(--violet-glow)' : 'none',
                  }}
                >
                  {KIND_GLYPH[e.kind]}
                </span>
                <div
                  style={{
                    color: 'var(--phosphor-faint)',
                    fontSize: 10,
                    letterSpacing: '0.08em',
                  }}
                >
                  <div>{fmt(e.at)}</div>
                  <div style={{ fontStyle: 'italic', opacity: 0.7 }}>{daysAgo(e.at)}</div>
                </div>
                <div>
                  <div
                    style={{
                      color: violet ? 'var(--violet)' : 'var(--phosphor)',
                      textShadow: violet ? '0 0 6px var(--violet-glow)' : 'none',
                      fontSize: 12,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {e.title}
                  </div>
                  <div
                    style={{
                      color: 'var(--phosphor-dim)',
                      fontSize: 11,
                      fontStyle: 'italic',
                      marginTop: 2,
                    }}
                  >
                    {e.blurb}
                  </div>
                </div>
              </div>
            );
          })}

        <pre
          style={{
            color: 'var(--phosphor-faint)',
            fontSize: 10,
            marginTop: 24,
          }}
        >
{`   // the timeline is the ledger of milestones.
   // the ledger proper is under /soul.`}
        </pre>
      </div>
    </div>
  );
}
