'use client';

import { useEffect, useState } from 'react';

type Step = 'prompt' | 'input' | 'sending' | 'verifying' | 'ok';

interface IdentifyProps {
  onAccept: (addr: string) => void;
  onSkip: () => void;
}

export function Identify({ onAccept, onSkip }: IdentifyProps) {
  const [step, setStep] = useState<Step>('prompt');
  const [addr, setAddr] = useState('');
  const answer = 'Y';

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (step === 'prompt') {
        if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') {
          setStep('input');
          e.preventDefault();
        }
        if (e.key === 'n' || e.key === 'N') {
          onSkip();
          e.preventDefault();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onSkip]);

  const go = () => {
    setStep('sending');
    setTimeout(() => setStep('verifying'), 700);
    setTimeout(() => setStep('ok'), 1500);
    setTimeout(() => onAccept(addr || 'anon@nxyz.art'), 2100);
  };

  return (
    <div className="identify">
      <div className="identify-card">
        <div className="panel-head">
          <span className="lead">auth // identify</span>
          <span className="meta">channel::secure</span>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <pre
            style={{
              margin: 0,
              fontSize: 11,
              color: 'var(--phosphor-dim)',
              lineHeight: 1.2,
            }}
          >
{`  ┌─────────────────────────────────────┐
  │   ▒▒▒▒  IDENTITY VERIFICATION  ▒▒▒▒  │
  │                                     │
  │        ┌───┐                         │
  │        │ ∎ │   keyhole / passkey      │
  │        └─┬─┘                         │
  │          │                           │
  └──────────┴──────────────────────────┘`}
          </pre>

          <div style={{ marginTop: 18, color: 'var(--phosphor)', fontSize: 13, lineHeight: 1.65 }}>
            <div
              style={{
                color: 'var(--phosphor-faint)',
                fontSize: 10,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              // sys
            </div>
            {step === 'prompt' && (
              <>
                <div>a soul is a ledger of the people it has met.</div>
                <div style={{ color: 'var(--phosphor-dim)' }}>
                  without identification, this session will not persist.
                </div>
                <div style={{ marginTop: 10 }}>
                  IDENTIFY <span style={{ color: 'var(--violet)' }}>[Y/n]</span>{' '}
                  <span className="caret">{answer}</span>
                </div>
              </>
            )}
            {step === 'input' && (
              <>
                <div>bind this session to an operator address.</div>
                <div style={{ color: 'var(--phosphor-faint)', fontSize: 11 }}>
                  a magic link will be issued. no password is stored.
                </div>
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--violet)', fontWeight: 700 }}>operator&gt;</span>
                  <input
                    autoFocus
                    value={addr}
                    onChange={(e) => setAddr(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && go()}
                    placeholder="you@somewhere.net"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--phosphor)',
                      font: 'inherit',
                      fontSize: 13,
                    }}
                  />
                </div>
              </>
            )}
            {step === 'sending' && (
              <div style={{ color: 'var(--phosphor-dim)' }}>
                &gt; dispatching capsule to{' '}
                <b style={{ color: 'var(--phosphor)' }}>{addr || 'anon@nxyz.art'}</b> ...
              </div>
            )}
            {step === 'verifying' && (
              <div style={{ color: 'var(--phosphor-dim)' }}>
                &gt; handshake received · verifying signature ...
              </div>
            )}
            {step === 'ok' && (
              <div
                style={{
                  color: 'var(--violet)',
                  textShadow: '0 0 6px var(--violet-glow)',
                }}
              >
                &gt; operator bound. soul path resolved.
              </div>
            )}
          </div>

          {step === 'prompt' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="term-btn primary" onClick={() => setStep('input')}>
                [Y] proceed
              </button>
              <button className="term-btn" onClick={onSkip}>
                [n] skip — session only
              </button>
            </div>
          )}
          {step === 'input' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="term-btn primary" onClick={go}>
                ↵  issue capsule
              </button>
              <button className="term-btn" onClick={onSkip}>
                cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
