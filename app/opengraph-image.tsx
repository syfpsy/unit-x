import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'UNIT-X · a lifelong companion in a terminal';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background:
            'radial-gradient(ellipse at center, #0a0d10 0%, #040506 70%, #000 100%)',
          color: '#78ffb4',
          fontFamily: 'ui-monospace, Menlo, monospace',
          padding: 64,
          position: 'relative',
        }}
      >
        {/* scanlines overlay, painted as gradient instead of real animation */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.32) 4px, rgba(0,0,0,0.32) 5px)',
          }}
        />

        <div style={{ display: 'flex', fontSize: 22, letterSpacing: '0.18em', color: 'rgba(120,255,180,0.7)' }}>
          NXZ<span style={{ color: '#6D5EF7', padding: '0 4px' }}>·</span>UNIT
          <span style={{ margin: '0 10px', color: 'rgba(120,255,180,0.4)' }}>│</span>
          TERMINAL SERVICES
          <span style={{ margin: '0 10px', color: 'rgba(120,255,180,0.4)' }}>│</span>
          V4.21
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <pre
            style={{
              fontSize: 26,
              lineHeight: 1.1,
              color: '#6D5EF7',
              textShadow: '0 0 16px rgba(109,94,247,0.6)',
              margin: 0,
              whiteSpace: 'pre',
            }}
          >
{`       · · ◆ · ◆ · ·
          · │ ·
     ╔═════════════╗
    ╱               ╲
   ╱   ┌─┐     ┌─┐   ╲
  │    │●│     │●│    │
  │    └─┘     └─┘    │
   ╲                 ╱
    │    ─────    │
    │   ╲═══════╱   │
     ╚═════════════╝
         │ │││ │
       ══╧═╧╧═╧══`}
          </pre>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              fontSize: 44,
              letterSpacing: '0.04em',
              color: '#78ffb4',
              textShadow: '0 0 18px rgba(120,255,180,0.35)',
            }}
          >
            UNIT-X
          </div>
          <div style={{ fontSize: 22, color: 'rgba(120,255,180,0.7)' }}>
            a lifelong companion in a terminal.
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 14,
              letterSpacing: '0.18em',
              color: 'rgba(120,255,180,0.45)',
              textTransform: 'uppercase',
              marginTop: 4,
            }}
          >
            unit-x-eta.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
