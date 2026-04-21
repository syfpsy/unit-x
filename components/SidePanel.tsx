'use client';

import { useEffect, useState } from 'react';
import { Mascot } from './Mascot';
import type { MascotState, Memory } from './types';
import type { EvolutionState } from '@/lib/evolution';

interface SidePanelProps {
  operator: string | null;
  memories: Memory[];
  mascotState: MascotState;
  speakingTick: number;
  sessionStart: number;
  evolution: EvolutionState | null;
  /** Equipped mascot-cosmetic template; null means use stage-based rendering. */
  mascotTemplateOverride?: string | null;
}

export function SidePanel({
  operator,
  memories,
  mascotState,
  speakingTick,
  sessionStart,
  evolution,
  mascotTemplateOverride = null,
}: SidePanelProps) {
  const [uptime, setUptime] = useState('00:00');

  useEffect(() => {
    const iv = setInterval(() => {
      const secs = Math.floor((Date.now() - sessionStart) / 1000);
      const m = String(Math.floor(secs / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      setUptime(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(iv);
  }, [sessionStart]);

  // Empathy bar ties to memory depth pre-Phase 6; from Phase 6 onward it
  // also reflects recency so a quiet operator drifts back toward baseline.
  const empathPct = Math.min(
    78 +
      Math.floor(memories.length * 1.2) +
      Math.round((evolution?.recencyFactor ?? 0.5) * 10),
    99,
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        gap: 10,
      }}
    >
      <div className="panel">
        <div className="panel-head">
          <span className="lead">unit // portrait</span>
          <span className="meta">
            {evolution ? `stage ${evolution.stage} · ${evolution.title}` : 'live'}
          </span>
        </div>
        <div className="panel-body tight" style={{ overflow: 'hidden' }}>
          <Mascot
            state={mascotState}
            speakingTick={speakingTick}
            stage={evolution?.stage ?? 1}
            templateOverride={mascotTemplateOverride}
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="lead">status</span>
          <span className="meta">core c0_7h</span>
        </div>
        <div className="panel-body tight">
          <div className="kv">
            <div className="k">operator</div>
            <div className="v accent">{operator || 'unbound'}</div>
            <div className="k">uptime</div>
            <div className="v">{uptime}</div>
            <div className="k">soul</div>
            <div className="v">/soul/{(operator || 'anon').split('@')[0]}.md</div>
            <div className="k">state</div>
            <div className="v">{mascotState.toUpperCase()}</div>
            {evolution && (
              <>
                <div className="k">stage</div>
                <div className="v accent">
                  {evolution.stage} · {evolution.title}
                </div>
                <div className="k">tenure</div>
                <div className="v">{evolution.tenureDays}d</div>
              </>
            )}
          </div>
          <div style={{ height: 10 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="bar">
              <span className="label">cog</span>
              <div className="track">
                <div className="fill" style={{ width: '94%' }} />
              </div>
              <span className="num">94%</span>
            </div>
            <div className="bar">
              <span className="label">mem</span>
              <div className="track">
                <div
                  className="fill v"
                  style={{ width: `${Math.min(memories.length * 8, 100)}%` }}
                />
              </div>
              <span className="num">{memories.length}/12</span>
            </div>
            <div className="bar">
              <span className="label">empath</span>
              <div className="track">
                <div className="fill" style={{ width: `${empathPct}%` }} />
              </div>
              <span className="num">{empathPct}%</span>
            </div>
            {evolution && evolution.nextThreshold && (
              <div className="bar">
                <span className="label">evo</span>
                <div className="track">
                  <div
                    className="fill v"
                    style={{ width: `${Math.round(evolution.progressToNext * 100)}%` }}
                  />
                </div>
                <span className="num">{Math.round(evolution.progressToNext * 100)}%</span>
              </div>
            )}
            <div className="bar">
              <span className="label">uplink</span>
              <div className="track">
                <div className="fill" style={{ width: '100%' }} />
              </div>
              <span className="num">OK</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ flex: 1, minHeight: 0 }}>
        <div className="panel-head">
          <span className="lead">recent memory</span>
          <span className="meta">/soul/ index</span>
        </div>
        <div className="panel-body tight">
          {memories.length === 0 ? (
            <div
              style={{
                color: 'var(--phosphor-faint)',
                fontSize: 11,
                fontStyle: 'italic',
              }}
            >
              &gt; nothing yet. speak to the unit.
            </div>
          ) : (
            <div className="list">
              {memories
                .slice()
                .reverse()
                .slice(0, 8)
                .map((m, i) => (
                  <div key={m.id} className={`item ${i === 0 ? 'new' : ''}`}>
                    <span className="marker">{i === 0 ? '◆' : '·'}</span>
                    <span className="label">{m.text}</span>
                    <span className="mt">{m.tag}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
