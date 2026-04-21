import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'UNIT-X // privacy',
  description: 'what the unit keeps, where it lives, and how to make it forget.',
};

export default function PrivacyPage() {
  return (
    <div className="crt-root">
      <div className="crt-content glow-text crt-curve">
        <div className="topbar" style={{ marginBottom: 10 }}>
          <span className="brand">
            NXZ<span className="dot">·</span>UNIT
          </span>
          <span className="sep">│</span>
          <span className="crumb">privacy · policy</span>
          <div className="right">
            <a href="/" className="term-btn" style={{ textDecoration: 'none' }}>
              ← back
            </a>
          </div>
        </div>

        <div className="panel" style={{ flex: 1, overflow: 'auto' }}>
          <div className="panel-head">
            <span className="lead">/ privacy</span>
            <span className="meta">v1 · 2026-04-22</span>
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
   ║        ◆  P R I V A C Y  ◆                                   ║
   ║        ─────────────────                                     ║
   ║        what the unit keeps, where it lives, how to end it.   ║
   ║                                                              ║
   ╚══════════════════════════════════════════════════════════════╝`}
            </pre>

            <div style={{ height: 14 }} />

            <Section title="§ the short version">
              <p>
                UNIT-X keeps a ledger. every message you send, every reply
                the unit composes, and every tagged memory is saved to a
                private postgres row that only you can read. content is
                encrypted at rest. you can export it, forget it, or burn
                the whole ledger whenever you want.
              </p>
            </Section>

            <Section title="§ what we keep">
              <ul>
                <li>
                  your email address — used only to send you the magic link
                  and to bind your soul to a single operator row.
                </li>
                <li>every turn of every conversation (user + agent).</li>
                <li>
                  every memory the unit commits via{' '}
                  <code>&lt;remember tag=&quot;…&quot;&gt;</code> — short
                  phrases under 80 chars with one of four tags.
                </li>
                <li>
                  unlock + equip state for cosmetics you earn, and the
                  stages you cross as tenure and memory depth accumulate.
                </li>
                <li>a few boring timestamps: when you joined, when you last spoke.</li>
              </ul>
            </Section>

            <Section title="§ what we don’t keep">
              <ul>
                <li>analytics fingerprints, browser telemetry, ad identifiers.</li>
                <li>third-party trackers. the site loads no external scripts besides fonts.</li>
                <li>
                  plaintext of your conversation in any log or audit trail
                  — the logger redacts content before stringify.
                </li>
                <li>your password. magic link + google OAuth only; no password is ever stored.</li>
              </ul>
            </Section>

            <Section title="§ where it lives">
              <p>
                data is held in supabase postgres in the us-east-1 region.
                app is hosted on vercel. text content is encrypted with
                AES-256-GCM under a key derived from a server-held master
                key plus your operator id — if someone steals the database,
                they still need the master key (which lives only in the
                vercel env).
              </p>
            </Section>

            <Section title="§ third parties">
              <ul>
                <li><b>supabase</b> — auth provider + database host.</li>
                <li><b>deepseek</b> — language model that produces the unit’s voice. every user turn is sent to them to synthesize a reply. deepseek does not receive your email.</li>
                <li><b>vercel</b> — app host.</li>
                <li><b>google</b> — only if you choose the google sign-in button. google gives us your email; that is all.</li>
              </ul>
            </Section>

            <Section title="§ cookies">
              <p>
                two categories, both strictly necessary. a session cookie
                set by supabase so the unit recognises you across requests,
                and a tiny local preference cache for phosphor + CRT
                settings and the equipped boot banner. no analytics
                cookies, no ads, no cross-site.
              </p>
            </Section>

            <Section title="§ your controls">
              <ul>
                <li>
                  <code>/forget &lt;keyword&gt;</code> — soft-deletes any
                  memories matching the keyword. ciphertext is overwritten
                  with zeros after a 30-day grace period.
                </li>
                <li>
                  <code>/export</code> — downloads every decrypted row we
                  hold about you as a single JSON file.
                </li>
                <li>
                  <code>/delete-account</code> — after typing{' '}
                  <code>DELETE MY SOUL</code>, hard-removes the operator
                  row, cascading to every message, memory, cosmetic, stage
                  transition, and the underlying auth user.
                </li>
              </ul>
            </Section>

            <Section title="§ contact">
              <p>
                for anything not covered here, email the operator at{' '}
                <a href="mailto:hello@nxyz.art">hello@nxyz.art</a>.
              </p>
            </Section>

            <pre
              style={{
                color: 'var(--phosphor-faint)',
                fontSize: 10,
                marginTop: 24,
              }}
            >
{`   // privacy is not a feature.
   // it is the floor the product stands on.`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="soul-section">
      <div className="shead">{title}</div>
      <div
        style={{
          color: 'var(--phosphor)',
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        {children}
      </div>
    </div>
  );
}
