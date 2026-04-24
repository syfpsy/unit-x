'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { CRTMode, CRTToggles, PhosphorKey, TweakState } from './types';

export const PHOSPHORS: Record<
  PhosphorKey,
  { r: number; g: number; b: number; label: string }
> = {
  green:  { r: 120, g: 255, b: 180, label: 'green' },
  amber:  { r: 255, g: 180, b: 90,  label: 'amber' },
  cyan:   { r: 120, g: 220, b: 255, label: 'cyan' },
  violet: { r: 180, g: 150, b: 255, label: 'violet' },
  white:  { r: 230, g: 235, b: 240, label: 'white' },
};

const PRESETS: Record<Exclude<CRTMode, 'custom'>, CRTToggles> = {
  off:    { flicker: false, scanlines: false, beam: false, glow: false, curve: false },
  subtle: { flicker: true,  scanlines: true,  beam: true,  glow: true,  curve: false },
  full:   { flicker: true,  scanlines: true,  beam: true,  glow: true,  curve: true  },
};

const CRT_LAYERS: ReadonlyArray<{ key: keyof CRTToggles; label: string; blurb: string }> = [
  { key: 'flicker',   label: 'flicker',   blurb: 'occasional brightness jitter' },
  { key: 'scanlines', label: 'scanlines', blurb: 'horizontal raster bands' },
  { key: 'beam',      label: 'beam',      blurb: 'travelling refresh sweep' },
  { key: 'glow',      label: 'glow',      blurb: 'phosphor bloom + backdrop blur' },
  { key: 'curve',     label: 'curvature', blurb: 'subtle barrel rotate' },
];

interface SettingsProps {
  state: TweakState;
  setState: Dispatch<SetStateAction<TweakState>>;
  onClose: () => void;
}

/**
 * Full-screen settings modal. Replaces the old floating `.tweaks-panel`
 * with a full overlay in the same aesthetic as /soul, /gallery,
 * /timeline — so settings feel like a real page, not a widget.
 *
 * Defaults in TWEAK_DEFAULTS ship all CRT layers OFF; anyone who wants
 * the bloom flips it on here (or picks a preset from the dropdown).
 */
export function Settings({ state, setState, onClose }: SettingsProps) {
  const set = <K extends keyof TweakState>(k: K, v: TweakState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const setCrtPreset = (mode: CRTMode) => {
    setState((s) => {
      if (mode === 'custom') return { ...s, crt: 'custom' };
      const preset = PRESETS[mode];
      return { ...s, crt: mode, crtToggles: preset, scanlines: preset.scanlines };
    });
  };

  const toggleLayer = (key: keyof CRTToggles) => {
    setState((s) => {
      const next = { ...s.crtToggles, [key]: !s.crtToggles[key] };
      return {
        ...s,
        crt: 'custom',
        crtToggles: next,
        scanlines: next.scanlines,
      };
    });
  };

  return (
    <div
      className="soul-doc"
      role="dialog"
      aria-modal="true"
      aria-label="settings"
    >
      <div className="panel-head">
        <span className="lead">/ settings</span>
        <span className="meta">preferences · local to this device</span>
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
   ║        ◆  S E T T I N G S  ◆                                 ║
   ║        ───────────────────                                   ║
   ║        aesthetic, layout, and pace. nothing identity-level.  ║
   ║                                                              ║
   ╚══════════════════════════════════════════════════════════════╝`}
        </pre>

        <div style={{ height: 14 }} />

        {/* § phosphor */}
        <div className="soul-section">
          <div className="shead">§ phosphor</div>
          <Row label="colour">
            <div className="swatches">
              {(Object.entries(PHOSPHORS) as Array<[PhosphorKey, (typeof PHOSPHORS)[PhosphorKey]]>).map(
                ([k, v]) => (
                  <div
                    key={k}
                    className={`swatch ${state.phosphor === k ? 'active' : ''}`}
                    title={v.label}
                    style={{
                      background: `rgb(${v.r},${v.g},${v.b})`,
                      color: `rgb(${v.r},${v.g},${v.b})`,
                    }}
                    onClick={() => set('phosphor', k)}
                    role="button"
                    aria-label={v.label}
                  />
                ),
              )}
            </div>
          </Row>
        </div>

        {/* § crt */}
        <div className="soul-section">
          <div className="shead">§ crt stack</div>
          <Row label="preset">
            <select
              value={state.crt}
              onChange={(e) => setCrtPreset(e.target.value as CRTMode)}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--phosphor)',
                font: 'inherit',
                fontSize: 12,
                padding: '3px 6px',
              }}
            >
              <option value="off">off — clean terminal, no movement</option>
              <option value="subtle">subtle — muted crt</option>
              <option value="full">full — all layers</option>
              <option value="custom">custom — per-layer below</option>
            </select>
          </Row>

          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CRT_LAYERS.map(({ key, label, blurb }) => (
              <label
                key={key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '18px 110px 1fr',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: '4px 0',
                  borderBottom: '1px dashed var(--border-faint)',
                  color: state.crtToggles[key] ? 'var(--phosphor)' : 'var(--phosphor-faint)',
                }}
              >
                <input
                  type="checkbox"
                  checked={state.crtToggles[key]}
                  onChange={() => toggleLayer(key)}
                  style={{
                    appearance: 'none',
                    width: 14,
                    height: 14,
                    border: '1px solid var(--border)',
                    background: state.crtToggles[key] ? 'var(--violet)' : 'transparent',
                    boxShadow: state.crtToggles[key] ? '0 0 6px var(--violet-glow)' : 'none',
                    cursor: 'pointer',
                  }}
                />
                <span
                  style={{
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    fontSize: 10,
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    color: 'var(--phosphor-faint)',
                    fontStyle: 'italic',
                    fontSize: 11,
                  }}
                >
                  {blurb}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* § shell */}
        <div className="soul-section">
          <div className="shead">§ shell</div>
          <Row label="type speed">
            <input
              type="range"
              min="1"
              max="80"
              value={state.typeSpeed}
              onChange={(e) => set('typeSpeed', +e.target.value)}
              style={{ width: '100%' }}
              aria-label="typewriter speed"
            />
          </Row>
          <Row label="unit name">
            <input
              type="text"
              value={state.unitName}
              onChange={(e) => set('unitName', e.target.value)}
              maxLength={32}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--phosphor)',
                font: 'inherit',
                fontSize: 12,
                padding: '3px 6px',
                width: '100%',
              }}
            />
          </Row>
          <Row label="layout">
            <select
              value={state.layout}
              onChange={(e) => set('layout', e.target.value as TweakState['layout'])}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--phosphor)',
                font: 'inherit',
                fontSize: 12,
                padding: '3px 6px',
              }}
            >
              <option value="side-right">side right</option>
              <option value="side-left">side left</option>
              <option value="solo">solo — no side panel</option>
            </select>
          </Row>
        </div>

        <pre
          style={{
            color: 'var(--phosphor-faint)',
            fontSize: 10,
            marginTop: 18,
          }}
        >
{`   // settings persist per device.
   // clear your browser storage to reset.`}
        </pre>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '100px 1fr',
        gap: 12,
        alignItems: 'center',
        padding: '4px 0',
      }}
    >
      <div
        style={{
          color: 'var(--phosphor-faint)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}
