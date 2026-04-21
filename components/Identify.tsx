'use client';

import { useEffect, useMemo, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Step =
  | 'prompt'
  | 'choose' // picked Y; now choose between magic-link email or Google OAuth
  | 'email' // collecting magic-link email
  | 'sending' // dispatching to Supabase
  | 'sent' // awaiting user to click email link
  | 'oauth_redirect' // redirecting to Google
  | 'ok' // session confirmed
  | 'error';

interface IdentifyProps {
  onAccept: (identity: { email: string; handle: string }) => void;
  onSkip: () => void;
  initialError?: string | null;
}

export function Identify({ onAccept, onSkip, initialError }: IdentifyProps) {
  const [step, setStep] = useState<Step>(initialError ? 'error' : 'prompt');
  const [addr, setAddr] = useState('');
  const [errMsg, setErrMsg] = useState<string | null>(initialError ?? null);
  const answer = 'Y';

  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  // Poll for an established session so the gate advances automatically
  // after the user clicks their magic link in another tab.
  useEffect(() => {
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const email = session.user.email ?? 'operator@nxyz.art';
        const handle = (email.split('@')[0] || 'operator').toLowerCase();
        setStep('ok');
        setTimeout(() => onAccept({ email, handle }), 600);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, onAccept]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (step === 'prompt') {
        if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') {
          setStep('choose');
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

  async function sendMagicLink() {
    if (!supabase) {
      setErrMsg('supabase client not available');
      setStep('error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setErrMsg('that does not look like an address');
      setStep('error');
      return;
    }
    setStep('sending');
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    if (error) {
      setErrMsg(error.message.slice(0, 120));
      setStep('error');
      return;
    }
    setStep('sent');
  }

  async function signInWithGoogle() {
    if (!supabase) {
      setErrMsg('supabase client not available');
      setStep('error');
      return;
    }
    setStep('oauth_redirect');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setErrMsg(error.message.slice(0, 120));
      setStep('error');
    }
  }

  return (
    <div
      className="identify"
      role="dialog"
      aria-modal="true"
      aria-labelledby="identify-title"
    >
      <div className="identify-card">
        <div className="panel-head">
          <span className="lead" id="identify-title">auth // identify</span>
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

            {step === 'choose' && (
              <>
                <div>bind this session to an operator.</div>
                <div style={{ color: 'var(--phosphor-faint)', fontSize: 11 }}>
                  no password is stored. the ledger follows the operator across devices.
                </div>
              </>
            )}

            {step === 'email' && (
              <>
                <div>issue a magic link.</div>
                <div style={{ color: 'var(--phosphor-faint)', fontSize: 11 }}>
                  a single-use capsule will arrive by email. click it to bind.
                </div>
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--violet)', fontWeight: 700 }}>operator&gt;</span>
                  <input
                    autoFocus
                    value={addr}
                    onChange={(e) => setAddr(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMagicLink()}
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
                &gt; dispatching capsule to <b style={{ color: 'var(--phosphor)' }}>{addr}</b> ...
              </div>
            )}
            {step === 'sent' && (
              <>
                <div style={{ color: 'var(--phosphor)' }}>
                  &gt; capsule sent. check your inbox.
                </div>
                <div style={{ color: 'var(--phosphor-faint)', fontSize: 11 }}>
                  click the link there. this panel will advance automatically.
                </div>
              </>
            )}
            {step === 'oauth_redirect' && (
              <div style={{ color: 'var(--phosphor-dim)' }}>
                &gt; handing off to google ...
              </div>
            )}
            {step === 'ok' && (
              <div style={{ color: 'var(--violet)', textShadow: '0 0 6px var(--violet-glow)' }}>
                &gt; operator bound. soul path resolved.
              </div>
            )}
            {step === 'error' && (
              <>
                <div style={{ color: 'var(--hostile)' }}>
                  &gt; handshake refused.
                </div>
                {errMsg && (
                  <div style={{ color: 'var(--hostile)', fontSize: 11, opacity: 0.8 }}>
                    {errMsg}
                  </div>
                )}
              </>
            )}
          </div>

          {step === 'prompt' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="term-btn primary" onClick={() => setStep('choose')}>
                [Y] proceed
              </button>
              <button className="term-btn" onClick={onSkip}>
                [n] skip — session only
              </button>
            </div>
          )}
          {step === 'choose' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <button className="term-btn primary" onClick={signInWithGoogle}>
                ◆ google
              </button>
              <button className="term-btn primary" onClick={() => setStep('email')}>
                ◆ magic link
              </button>
              <button className="term-btn" onClick={() => setStep('prompt')}>
                back
              </button>
            </div>
          )}
          {step === 'email' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="term-btn primary" onClick={sendMagicLink}>
                ↵  issue capsule
              </button>
              <button className="term-btn" onClick={() => setStep('choose')}>
                back
              </button>
            </div>
          )}
          {step === 'sent' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                className="term-btn"
                onClick={() => {
                  setStep('email');
                }}
              >
                resend
              </button>
              <button className="term-btn" onClick={onSkip}>
                skip — session only
              </button>
            </div>
          )}
          {step === 'error' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                className="term-btn primary"
                onClick={() => {
                  setErrMsg(null);
                  setStep('choose');
                }}
              >
                retry
              </button>
              <button className="term-btn" onClick={onSkip}>
                skip — session only
              </button>
            </div>
          )}

          <div
            style={{
              marginTop: 22,
              paddingTop: 10,
              borderTop: '1px dashed var(--border-faint)',
              display: 'flex',
              gap: 18,
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--phosphor-faint)',
            }}
          >
            <a href="/privacy" style={{ color: 'var(--phosphor-faint)' }}>
              privacy
            </a>
            <a href="/terms" style={{ color: 'var(--phosphor-faint)' }}>
              terms
            </a>
            <span style={{ marginLeft: 'auto' }}>
              by proceeding you accept both.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
