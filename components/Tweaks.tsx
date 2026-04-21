'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { CRTMode, CRTToggles, PhosphorKey, TweakState } from './types';

export const PHOSPHORS: Record<
  PhosphorKey,
  { r: number; g: number; b: number; label: string }
> = {
  green: { r: 120, g: 255, b: 180, label: 'green' },
  amber: { r: 255, g: 180, b: 90, label: 'amber' },
  cyan: { r: 120, g: 220, b: 255, label: 'cyan' },
  violet: { r: 180, g: 150, b: 255, label: 'violet' },
  white: { r: 230, g: 235, b: 240, label: 'white' },
};

const PRESETS: Record<Exclude<CRTMode, 'custom'>, CRTToggles> = {
  off:    { flicker: false, scanlines: false, beam: false, glow: false, curve: false },
  subtle: { flicker: true,  scanlines: true,  beam: true,  glow: true,  curve: false },
  full:   { flicker: true,  scanlines: true,  beam: true,  glow: true,  curve: true  },
};

const CRT_LAYERS: ReadonlyArray<{ key: keyof CRTToggles; label: string }> = [
  { key: 'flicker',   label: 'flicker' },
  { key: 'scanlines', label: 'scanlines' },
  { key: 'beam',      label: 'beam' },
  { key: 'glow',      label: 'glow' },
  { key: 'curve',     label: 'curvature' },
];

interface TweaksProps {
  open: boolean;
  state: TweakState;
  setState: Dispatch<SetStateAction<TweakState>>;
}

export function Tweaks({ open, state, setState }: TweaksProps) {
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
    <div className={`tweaks-panel ${open ? 'open' : ''}`}>
      <div className="th">◆ tweaks · unit-x terminal</div>
      <div className="tb">
        <div className="tweak-row">
          <div className="lab">phosphor</div>
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
                />
              ),
            )}
          </div>
        </div>

        <div className="tweak-row">
          <div className="lab">crt preset</div>
          <select
            value={state.crt}
            onChange={(e) => setCrtPreset(e.target.value as CRTMode)}
          >
            <option value="off">off</option>
            <option value="subtle">subtle</option>
            <option value="full">full</option>
            <option value="custom">custom</option>
          </select>
        </div>

        <div
          style={{
            borderTop: '1px dashed var(--border-faint)',
            margin: '2px -12px 2px',
            padding: '8px 12px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div
            style={{
              color: 'var(--phosphor-faint)',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              marginBottom: 2,
            }}
          >
            crt layers
          </div>
          {CRT_LAYERS.map(({ key, label }) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                cursor: 'pointer',
                color: state.crtToggles[key] ? 'var(--phosphor)' : 'var(--phosphor-faint)',
              }}
            >
              <input
                type="checkbox"
                checked={state.crtToggles[key]}
                onChange={() => toggleLayer(key)}
                style={{
                  appearance: 'none',
                  width: 12,
                  height: 12,
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
            </label>
          ))}
        </div>

        <div className="tweak-row">
          <div className="lab">speed</div>
          <input
            type="range"
            min="1"
            max="80"
            value={state.typeSpeed}
            onChange={(e) => set('typeSpeed', +e.target.value)}
          />
        </div>

        <div className="tweak-row">
          <div className="lab">unit name</div>
          <input
            type="text"
            value={state.unitName}
            onChange={(e) => set('unitName', e.target.value)}
          />
        </div>

        <div className="tweak-row">
          <div className="lab">layout</div>
          <select
            value={state.layout}
            onChange={(e) => set('layout', e.target.value as TweakState['layout'])}
          >
            <option value="side-right">side right</option>
            <option value="side-left">side left</option>
            <option value="solo">solo</option>
          </select>
        </div>
      </div>
    </div>
  );
}
