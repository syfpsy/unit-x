'use client';

import type { Memory } from './types';

interface SoulDocProps {
  operator: string | null;
  memories: Memory[];
  onClose: () => void;
}

export function SoulDoc({ operator, memories, onClose }: SoulDocProps) {
  const name = (operator || 'anon').split('@')[0];
  const facts = memories.filter((m) => m.tag === 'fact');
  const relationships = memories.filter((m) => m.tag === 'rel');
  const threads = memories.filter((m) => m.tag === 'thread');
  const recent = memories.slice(-6).reverse();

  const header = `
   ╔══════════════════════════════════════════════════════════════╗
   ║                                                              ║
   ║        ◆  S O U L . M D  ◆    ${name.padEnd(28)}  ║
   ║        ─────────────────                                     ║
   ║        a ledger of what the unit has come to know            ║
   ║                                                              ║
   ╚══════════════════════════════════════════════════════════════╝`;

  return (
    <div className="soul-doc">
      <div className="panel-head">
        <span className="lead">/ soul / {name}.md</span>
        <span className="meta">read-only · {memories.length} entries</span>
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
          {header}
        </pre>

        <div style={{ height: 14 }} />

        <div className="soul-section">
          <div className="shead">§ identity</div>
          <div className="soul-entry">
            <span className="dt">bound</span>
            <span className="tx">{operator || 'anonymous session'}</span>
          </div>
          <div className="soul-entry">
            <span className="dt">handle</span>
            <span className="tx">{name}</span>
          </div>
          <div className="soul-entry">
            <span className="dt">first_seen</span>
            <span className="tx">{new Date().toISOString().slice(0, 10)}</span>
          </div>
        </div>

        <div className="soul-section">
          <div className="shead">§ facts learned</div>
          {facts.length === 0 && (
            <div
              style={{
                color: 'var(--phosphor-faint)',
                fontSize: 11,
                fontStyle: 'italic',
              }}
            >
              &gt; none yet
            </div>
          )}
          {facts.map((e) => (
            <div key={e.id} className="soul-entry">
              <span className="dt">{new Date(e.ts).toLocaleDateString()}</span>
              <span className="tx">{e.text}</span>
            </div>
          ))}
        </div>

        <div className="soul-section">
          <div className="shead">§ people &amp; things</div>
          {relationships.length === 0 && (
            <div
              style={{
                color: 'var(--phosphor-faint)',
                fontSize: 11,
                fontStyle: 'italic',
              }}
            >
              &gt; none yet
            </div>
          )}
          {relationships.map((e) => (
            <div key={e.id} className="soul-entry">
              <span className="dt">{new Date(e.ts).toLocaleDateString()}</span>
              <span className="tx">{e.text}</span>
            </div>
          ))}
        </div>

        <div className="soul-section">
          <div className="shead">§ open threads</div>
          {threads.length === 0 && (
            <div
              style={{
                color: 'var(--phosphor-faint)',
                fontSize: 11,
                fontStyle: 'italic',
              }}
            >
              &gt; none yet
            </div>
          )}
          {threads.map((e) => (
            <div key={e.id} className="soul-entry">
              <span className="dt">{new Date(e.ts).toLocaleDateString()}</span>
              <span className="tx">{e.text}</span>
            </div>
          ))}
        </div>

        <div className="soul-section">
          <div className="shead">§ recent — last six exchanges</div>
          {recent.map((e, i) => (
            <div key={e.id} className={`soul-entry ${i < 2 ? 'recent' : ''}`}>
              <span className="dt">{new Date(e.ts).toLocaleTimeString().slice(0, 5)}</span>
              <span className="tx">{e.text}</span>
            </div>
          ))}
        </div>

        <pre
          style={{
            color: 'var(--phosphor-faint)',
            fontSize: 10,
            marginTop: 24,
          }}
        >
{`   // end of file
   // the unit will remember what matters.
   // the rest is weather.`}
        </pre>
      </div>
    </div>
  );
}
