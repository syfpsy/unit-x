'use client';

import { useEffect, useState } from 'react';
import type { GalleryEntry } from '@/lib/cosmetics/types';

interface GalleryProps {
  onClose: () => void;
  onEquipped: (entry: GalleryEntry) => void;
}

const KIND_LABEL: Record<string, string> = {
  mascot: 'mascot',
  boot_banner: 'boot banner',
  phosphor_palette: 'phosphor',
  idle_art: 'idle art',
  frame: 'frame',
  divider: 'divider',
};

export function Gallery({ onClose, onEquipped }: GalleryProps) {
  const [entries, setEntries] = useState<GalleryEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/gallery');
        const body = (await res.json()) as { entries: GalleryEntry[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setErr(body.error || 'could not load gallery');
          return;
        }
        setEntries(body.entries);
      } catch (e) {
        if (!cancelled) setErr(String((e as Error).message || e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function equip(slug: string) {
    setEquipping(slug);
    try {
      const res = await fetch('/api/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const body = (await res.json()) as { equipped?: { kind: string; slug: string; payload: GalleryEntry['payload'] }; error?: string };
      if (!res.ok || body.error) throw new Error(body.error ?? 'equip failed');
      setEntries((prev) =>
        prev
          ? prev.map((e) =>
              e.kind === body.equipped!.kind
                ? { ...e, equipped: e.slug === slug }
                : e,
            )
          : prev,
      );
      const found = entries?.find((e) => e.slug === slug);
      if (found) onEquipped({ ...found, equipped: true });
    } catch (e) {
      setErr(String((e as Error).message || e));
    } finally {
      setEquipping(null);
    }
  }

  const grouped = (entries ?? []).reduce<Record<string, GalleryEntry[]>>((acc, e) => {
    (acc[e.kind] ||= []).push(e);
    return acc;
  }, {});

  const header = `
   ╔══════════════════════════════════════════════════════════════╗
   ║                                                              ║
   ║        ◆  G A L L E R Y  ◆                                   ║
   ║        ─────────────────                                     ║
   ║        a wardrobe of what the unit has earned with you       ║
   ║                                                              ║
   ╚══════════════════════════════════════════════════════════════╝`;

  return (
    <div
      className="soul-doc"
      role="dialog"
      aria-modal="true"
      aria-label="cosmetics gallery"
    >
      <div className="panel-head">
        <span className="lead">/ gallery</span>
        <span className="meta">
          {entries ? `${entries.filter((e) => e.unlocked).length}/${entries.length} unlocked` : '…'}
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
          {header}
        </pre>

        <div style={{ height: 14 }} />

        {err && (
          <div style={{ color: 'var(--hostile)', fontSize: 12, marginBottom: 10 }}>
            &gt; {err}
          </div>
        )}

        {!entries && !err && (
          <div style={{ color: 'var(--phosphor-faint)', fontStyle: 'italic', fontSize: 12 }}>
            &gt; loading cosmetics …
          </div>
        )}

        {entries &&
          Object.entries(grouped).map(([kind, items]) => (
            <div className="soul-section" key={kind}>
              <div className="shead">§ {KIND_LABEL[kind] ?? kind}</div>
              {items.map((e) => {
                const isDefault = e.slug.endsWith('-default') || e.slug.endsWith('-classic');
                const actionLabel = e.equipped
                  ? 'equipped'
                  : e.unlocked
                  ? isDefault
                    ? 'equip · default'
                    : 'equip'
                  : 'locked';
                return (
                  <div
                    key={e.slug}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: 12,
                      padding: '6px 0',
                      borderBottom: '1px dashed var(--border-faint)',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: e.unlocked ? 'var(--phosphor)' : 'var(--phosphor-faint)',
                          fontSize: 12,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {e.equipped ? '◆ ' : e.unlocked ? '· ' : '  '}
                        {e.name}
                      </div>
                      <div
                        style={{
                          color: 'var(--phosphor-faint)',
                          fontSize: 10,
                          fontStyle: 'italic',
                          marginTop: 2,
                        }}
                      >
                        {e.unlocked ? e.blurb : e.lockHint ?? 'locked'}
                      </div>
                    </div>
                    <button
                      className={`term-btn ${e.equipped ? 'primary' : ''}`}
                      disabled={!e.unlocked || e.equipped || equipping === e.slug}
                      onClick={() => equip(e.slug)}
                      style={{
                        opacity: e.unlocked ? 1 : 0.4,
                        cursor: e.unlocked && !e.equipped ? 'pointer' : 'default',
                      }}
                    >
                      {equipping === e.slug ? '…' : actionLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}

        <pre style={{ color: 'var(--phosphor-faint)', fontSize: 10, marginTop: 24 }}>
{`   // equipping a boot banner takes effect on next session.
   // mascot changes apply immediately.`}
        </pre>
      </div>
    </div>
  );
}
